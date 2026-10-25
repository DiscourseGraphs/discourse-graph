import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TFile } from "obsidian";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseNode } from "~/types";
import { collectDiscourseNodesFromVault } from "~/utils/getDiscourseNodes";
import { loadRelations } from "~/utils/relationsStore";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";
import {
  syncDiscourseNodeChanges,
  upsertConceptBatches,
} from "~/utils/syncDgNodesToSupabase";

vi.mock("~/utils/supabaseContext", () => ({
  getSupabaseContext: vi.fn(),
  getLoggedInClient: vi.fn(),
  getLocalSpaceUri: () => "obsidian:local-vault",
}));

vi.mock("~/utils/relationsStore", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadRelations: vi.fn(),
}));

vi.mock("~/utils/getDiscourseNodes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  collectDiscourseNodesFromVault: vi.fn(),
}));

const SPACE_ID = 7;

type RpcArgs = { data: LocalConceptDataInput[]; v_space_id: number };
type RpcResult = { data: number[] | null; error: unknown };

const fakeRpc = (
  respond: (args: RpcArgs) => RpcResult,
): Mock<(name: string, args: RpcArgs) => Promise<RpcResult>> =>
  vi.fn((_name: string, args: RpcArgs) => Promise.resolve(respond(args)));

const concepts = (count: number): LocalConceptDataInput[] =>
  Array.from({ length: count }, (_, i) => ({ source_local_id: `c${i}` }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("upsertConceptBatches", () => {
  it("sends the concepts to upsert_concepts in order, 200 per call", async () => {
    const rpc = fakeRpc(({ data }) => ({
      data: data.map((_, i) => i + 1),
      error: null,
    }));

    await upsertConceptBatches({
      concepts: concepts(450),
      supabaseClient: { rpc } as unknown as DGSupabaseClient,
      spaceId: SPACE_ID,
    });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "upsert_concepts",
      "upsert_concepts",
      "upsert_concepts",
    ]);
    const sentBatches = rpc.mock.calls.map(([, { data }]) =>
      data.map((concept) => concept.source_local_id),
    );
    expect(sentBatches.map((batch) => batch.length)).toEqual([200, 200, 50]);
    expect(sentBatches.flat()).toEqual(
      concepts(450).map((concept) => concept.source_local_id),
    );
  });

  it.each([
    ["a name conflict", -1],
    ["a failed write", -2],
  ])(
    "still sends the later batches when a row comes back as %s, then throws",
    async (_case, failedId) => {
      const rpc = fakeRpc(({ data }) => ({
        data: data.map((concept, i) =>
          concept.source_local_id === "c3" ? failedId : i + 1,
        ),
        error: null,
      }));

      await expect(
        upsertConceptBatches({
          concepts: concepts(450),
          supabaseClient: { rpc } as unknown as DGSupabaseClient,
          spaceId: SPACE_ID,
        }),
      ).rejects.toThrow(
        `upsert_concepts returned row failures for batch 1/3: ${failedId}: 1`,
      );
      expect(rpc).toHaveBeenCalledTimes(3);
    },
  );

  it("still sends the later batches when a call fails, then throws with every failure", async () => {
    const rpc = fakeRpc(({ data }) =>
      data[0]?.source_local_id === "c200"
        ? { data: null, error: { message: "statement timeout" } }
        : {
            data: data.map((concept) =>
              concept.source_local_id === "c401" ? -2 : 1,
            ),
            error: null,
          },
    );

    const upsert = upsertConceptBatches({
      concepts: concepts(450),
      supabaseClient: { rpc } as unknown as DGSupabaseClient,
      spaceId: SPACE_ID,
    });

    await expect(upsert).rejects.toThrow(
      "upsert_concepts failed for batch 2/3",
    );
    await expect(upsert).rejects.toThrow(
      "upsert_concepts returned row failures for batch 3/3: -2: 1",
    );
    expect(rpc).toHaveBeenCalledTimes(3);
  });
});

describe("syncDiscourseNodeChanges", () => {
  const CLAIM_TYPE: DiscourseNode = {
    id: "claim-type",
    name: "Claim",
    format: "CLM - {content}",
    created: 0,
    modified: 0,
  };
  const FRONTMATTER = { nodeTypeId: "claim-type", nodeInstanceId: "node-1" };
  const FILE = Object.assign(new TFile(), {
    path: "CLM - Claim.md",
    basename: "CLM - Claim",
    stat: { ctime: 1000, mtime: 2000, size: 10 },
  });

  const resolvedQuery = (data: unknown): Record<string, unknown> => {
    const query: Record<string, unknown> = {
      then: (resolve: (result: { data: unknown; error: null }) => void) =>
        resolve({ data, error: null }),
    };
    for (const method of ["select", "eq", "in", "order", "limit"])
      query[method] = () => query;
    query.maybeSingle = () => resolvedQuery(null);
    return query;
  };

  beforeEach(() => {
    vi.mocked(getSupabaseContext).mockResolvedValue({
      spaceId: SPACE_ID,
      userId: 3,
    } as Awaited<ReturnType<typeof getSupabaseContext>>);
    vi.mocked(loadRelations).mockResolvedValue({
      version: 1,
      lastModified: 0,
      relations: {},
    });
    vi.mocked(collectDiscourseNodesFromVault).mockResolvedValue([
      {
        file: FILE,
        frontmatter: FRONTMATTER,
        nodeTypeId: "claim-type",
        nodeInstanceId: "node-1",
      },
    ]);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("writes a content-only edit as the node's Concept with its full Content", async () => {
    const rpc = fakeRpc(() => ({ data: [11], error: null }));
    vi.mocked(getLoggedInClient).mockResolvedValue({
      from: (table: string) =>
        resolvedQuery(
          table === "my_contents"
            ? [{ source_local_id: "node-1", text: "CLM - Claim" }]
            : [],
        ),
      rpc,
    } as unknown as DGSupabaseClient);
    const plugin = {
      settings: {
        accountLocalId: "account-1",
        nodeTypes: [CLAIM_TYPE],
        relationTypes: [],
        discourseRelations: [],
      },
      app: {
        vault: {
          getAbstractFileByPath: () => FILE,
          read: () => Promise.resolve("Edited claim body"),
        },
        metadataCache: {
          getFileCache: () => ({ frontmatter: FRONTMATTER }),
        },
      },
    } as unknown as DiscourseGraphPlugin;

    await syncDiscourseNodeChanges(plugin, new Map([[FILE.path, ["content"]]]));

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("upsert_concepts", {
      data: [
        expect.objectContaining({
          source_local_id: "node-1",
          schema_represented_by_local_id: "claim-type",
          contents_inline: [
            expect.objectContaining({
              source_local_id: "node-1",
              variant: "full",
              text: "Edited claim body",
            }),
          ],
        }),
      ],
      v_space_id: SPACE_ID,
    });
  });
});
