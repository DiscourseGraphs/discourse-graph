import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import type { InputTextNode } from "roamjs-components/types/native";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import {
  findImportedNodeUidBySourceRid,
  writeImportedSourceIdentity,
} from "./importedSourceIdentity";
import { markdownToRoamBlocks } from "./markdownToRoamBlocks";

export type MaterializeSharedNodeResult =
  | { status: "created" | "updated"; pageUid: string }
  | { status: "failed"; reason: string };

const fetchFullMarkdown = async ({
  client,
  sharedNode,
}: {
  client: DGSupabaseClient;
  sharedNode: SharedNode;
}): Promise<{ markdown: string } | { error: string }> => {
  const { data, error } = await client
    .from("my_contents")
    .select("text")
    .eq("space_id", sharedNode.spaceId)
    .eq("source_local_id", sharedNode.sourceLocalId)
    .eq("variant", "full")
    .maybeSingle();
  if (error) return { error: error.message };
  return { markdown: data?.text ?? "" };
};

const createImportedPage = async ({
  sharedNode,
  tree,
}: {
  sharedNode: SharedNode;
  tree: InputTextNode[];
}): Promise<MaterializeSharedNodeResult> => {
  const collidingPageUid = getPageUidByPageTitle(sharedNode.title);
  if (collidingPageUid) {
    return {
      status: "failed",
      reason: `A page titled "${sharedNode.title}" already exists in this graph but was not imported from "${sharedNode.spaceName}". Rename or remove that page, then import again.`,
    };
  }
  const pageUid = await createPage({ title: sharedNode.title, tree });
  writeImportedSourceIdentity({
    pageUid,
    sourceModifiedAt: sharedNode.lastModified,
    sourceNodeRid: sharedNode.rid,
  });
  return { status: "created", pageUid };
};

const updateImportedPage = async ({
  pageUid,
  sharedNode,
  tree,
}: {
  pageUid: string;
  sharedNode: SharedNode;
  tree: InputTextNode[];
}): Promise<MaterializeSharedNodeResult> => {
  const localTitle = getPageTitleByPageUid(pageUid);
  if (localTitle !== sharedNode.title) {
    const collidingPageUid = getPageUidByPageTitle(sharedNode.title);
    if (collidingPageUid) {
      return {
        status: "failed",
        reason: `Cannot rename the imported page "${localTitle}" to "${sharedNode.title}": another page already has that title. Rename or remove that page, then import again.`,
      };
    }
    await window.roamAlphaAPI.updatePage({
      page: { uid: pageUid, title: sharedNode.title },
    });
  }
  for (const { uid } of getShallowTreeByParentUid(pageUid)) {
    await deleteBlock(uid);
  }
  for (const [order, node] of tree.entries()) {
    await createBlock({ parentUid: pageUid, order, node });
  }
  writeImportedSourceIdentity({
    pageUid,
    sourceModifiedAt: sharedNode.lastModified,
    sourceNodeRid: sharedNode.rid,
  });
  return { status: "updated", pageUid };
};

export const materializeSharedNode = async ({
  client,
  sharedNode,
}: {
  client: DGSupabaseClient;
  sharedNode: SharedNode;
}): Promise<MaterializeSharedNodeResult> => {
  if (sharedNode.platform !== "Obsidian") {
    return {
      status: "failed",
      reason: `Cannot import "${sharedNode.title}": materialization only supports Obsidian-origin nodes, and this node comes from ${sharedNode.platform}.`,
    };
  }
  try {
    const content = await fetchFullMarkdown({ client, sharedNode });
    if ("error" in content) {
      return {
        status: "failed",
        reason: `Could not fetch the content of "${sharedNode.title}" from "${sharedNode.spaceName}": ${content.error}`,
      };
    }
    const tree = markdownToRoamBlocks(content.markdown);
    const importedPageUid = await findImportedNodeUidBySourceRid(
      sharedNode.rid,
    );
    return importedPageUid
      ? await updateImportedPage({ pageUid: importedPageUid, sharedNode, tree })
      : await createImportedPage({ sharedNode, tree });
  } catch (error) {
    return {
      status: "failed",
      reason: `Materializing "${sharedNode.title}" (${sharedNode.rid}) failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
};
