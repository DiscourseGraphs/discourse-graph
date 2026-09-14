import { listGroupSharedNodes } from "@repo/database/lib/sharedNodes";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import type DiscourseGraphPlugin from "~/index";
import {
  getImportedNodesRaw,
  QueryEngine,
  type DiscourseNodeCandidate,
  type RemoteSpaceInfo,
} from "~/services/QueryEngine";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";
import { importSelectedNodes } from "~/utils/importNodes";
import type { TFile } from "obsidian";

/**
 * The rid a locally-imported copy of this node would carry in its
 * `importedFromRid` frontmatter (see `processFileContent` in importNodes.ts,
 * which always uses `"note"` regardless of the source platform) — the shared
 * identity key for "is this node already imported," scoped to its origin
 * space rather than just its bare local id (two different spaces can mint
 * the same local id).
 */
export const getExpectedImportedFromRid = (
  spaceUri: string,
  nodeInstanceId: string,
): string => spaceUriAndLocalIdToRid(spaceUri, nodeInstanceId, "note");

export type SpaceOption = { id: string; name: string };

// TEMP STUB — remove before this ships. Lets the "Show from other spaces" UI
// (list, badges, space filter, chip autocomplete) be exercised without real
// Supabase credentials configured locally. Opening/importing a result still
// hits Supabase for real via `importRemoteSpaceNode`, so that step is not
// covered by this stub.
const DUMMY_REMOTE_CANDIDATES: DiscourseNodeCandidate[] = [
  {
    title: "Claim - Retrieval quality improves with reranking",
    nodeTypeId: "",
    remoteSpace: {
      spaceId: 1001,
      spaceName: "Research Vault",
      spaceUri: "obsidian:dummy-research-vault",
      nodeInstanceId: "dummy-1",
    },
  },
  {
    title: "Question - Does chunk size affect recall more than embedding model?",
    nodeTypeId: "",
    remoteSpace: {
      spaceId: 1001,
      spaceName: "Research Vault",
      spaceUri: "obsidian:dummy-research-vault",
      nodeInstanceId: "dummy-2",
    },
  },
  {
    title: "Evidence - Benchmark shows 12% recall gain from reranking",
    nodeTypeId: "",
    remoteSpace: {
      spaceId: 1002,
      spaceName: "Lab Notebook",
      spaceUri: "obsidian:dummy-lab-notebook",
      nodeInstanceId: "dummy-3",
    },
  },
  {
    title: "Claim - Smaller chunks hurt long-context questions",
    nodeTypeId: "",
    remoteSpace: {
      spaceId: 1002,
      spaceName: "Lab Notebook",
      spaceUri: "obsidian:dummy-lab-notebook",
      nodeInstanceId: "dummy-4",
    },
  },
  {
    title: "Source - Lewis et al., Retrieval-Augmented Generation",
    nodeTypeId: "",
    remoteSpace: {
      spaceId: 1003,
      spaceName: "Shared Reading Group",
      spaceUri: "obsidian:dummy-shared-reading-group",
      nodeInstanceId: "dummy-5",
    },
  },
];

/**
 * Every node published to a space the user is a member of, across all spaces
 * except this vault's own. Vault-wide and network-bound like `getDiscourseTagCandidates`,
 * so `NodeSearchModal` only fetches this on demand ("Show from other spaces").
 */
const USE_DUMMY_REMOTE_DATA = true; // TEMP — see comment above. Flip to false (or delete this and the guard below) to restore the real fetch.

export const getRemoteSpaceCandidates = async (
  plugin: DiscourseGraphPlugin,
): Promise<DiscourseNodeCandidate[]> => {
  if (USE_DUMMY_REMOTE_DATA) return DUMMY_REMOTE_CANDIDATES;

  const client = await getLoggedInClient(plugin);
  if (!client) return [];
  const context = await getSupabaseContext(plugin);
  if (!context) return [];

  const sharedNodes = await listGroupSharedNodes({
    client,
    currentSpaceId: context.spaceId,
  });

  // Already-imported nodes show up as ordinary local results — skip the remote
  // duplicate. Keyed on the space-scoped `importedFromRid`, not the bare local
  // id: two different spaces can independently mint the same `sourceLocalId`,
  // and a bare-id dedup would then hide a genuinely different, never-imported
  // node from a second space just because some unrelated node from a first
  // space happens to share that id.
  const importedRids = new Set(
    getImportedNodesRaw({ plugin }).map((entry) => entry.importedFromRid),
  );

  return sharedNodes
    .filter(
      (node) =>
        !importedRids.has(
          getExpectedImportedFromRid(node.spaceUri, node.sourceLocalId),
        ),
    )
    .map((node) => ({
      title: node.title,
      nodeTypeId: "",
      remoteSpace: {
        spaceId: node.spaceId,
        spaceName: node.spaceName,
        spaceUri: node.spaceUri,
        nodeInstanceId: node.sourceLocalId,
      },
    }));
};

/** Every space with at least one remote candidate, for the space filter menu and chip autocomplete. */
export const getDistinctRemoteSpaces = (
  candidates: DiscourseNodeCandidate[],
): SpaceOption[] => {
  const nameById = new Map<string, string>();
  for (const candidate of candidates) {
    if (candidate.remoteSpace) {
      nameById.set(String(candidate.remoteSpace.spaceId), candidate.remoteSpace.spaceName);
    }
  }
  return [...nameById.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Brings a remote node into the vault (reusing the same import path as the
 * "Import nodes" modal) and returns the resulting local file, so the search
 * modal can open a remote result exactly like any other.
 */
export const importRemoteSpaceNode = async ({
  plugin,
  remoteSpace,
  title,
}: {
  plugin: DiscourseGraphPlugin;
  remoteSpace: RemoteSpaceInfo;
  title: string;
}): Promise<TFile> => {
  const result = await importSelectedNodes({
    plugin,
    selectedNodes: [
      {
        nodeInstanceId: remoteSpace.nodeInstanceId,
        title,
        spaceId: remoteSpace.spaceId,
        spaceName: remoteSpace.spaceName,
        groupId: String(remoteSpace.spaceId),
        selected: false,
      },
    ],
  });
  if (result.success === 0) {
    throw new Error("Failed to import node from remote space");
  }
  const expectedRid = getExpectedImportedFromRid(
    remoteSpace.spaceUri,
    remoteSpace.nodeInstanceId,
  );
  // `importSelectedNodes` already has the file it just wrote — prefer that
  // directly over re-discovering it through `metadataCache`, which can still
  // be indexing the write we just made and momentarily report nothing at
  // this rid. Space-scoped either way (not `getFileByEndpoint`'s bare-id
  // search): a different pre-existing local/imported file could otherwise
  // share this remote node's `nodeInstanceId` from a different origin space,
  // resolving to the wrong file.
  const file =
    result.importedFiles.get(expectedRid) ??
    new QueryEngine(plugin.app).getFileByImportedFromRid(expectedRid);
  if (!file) {
    throw new Error("Imported node could not be located in the vault");
  }
  return file;
};
