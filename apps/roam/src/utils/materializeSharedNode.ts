import createPage from "roamjs-components/writes/createPage";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import type { InputTextNode } from "roamjs-components/types";
import type { CrossAppNode } from "@repo/database/crossAppNodeContract";
import {
  findImportedNodeUidByRid,
  readImportedSourceIdentity,
  toImportedSourceIdentity,
  writeImportedSourceIdentity,
} from "./importedSourceIdentity";
import { markdownToRoamBlocks } from "./markdownToRoamBlocks";

/**
 * Outcome of materializing one shared node, so the import action (ENG-1859) can
 * tally counts. `skipped` means the page was already imported and unchanged.
 */
export type MaterializeResult =
  | { status: "created" | "updated" | "skipped"; pageUid: string }
  | { status: "failed"; error: string };

/** Overwrite a page's body: clear its existing blocks, then write the new tree. */
const replacePageBody = async (
  pageUid: string,
  blocks: InputTextNode[],
): Promise<void> => {
  const existing = getFullTreeByParentUid(pageUid).children ?? [];
  await Promise.all(existing.map((child) => deleteBlock(child.uid)));
  await Promise.all(
    blocks.map((node, order) =>
      createBlock({ parentUid: pageUid, node, order }),
    ),
  );
};

/**
 * Materialize one Obsidian-origin shared node into the local Roam graph: create a
 * page from its `content.full` markdown, or update the page already imported from
 * the same source (matched by `sourceNodeRid`) without creating a duplicate. The
 * imported source identity is (re)written to the page's block props so the node
 * can be re-found and refreshed. Pure markdown parsing lives in
 * `markdownToRoamBlocks`; identity persistence/lookup in `importedSourceIdentity`.
 *
 * MVP0 keeps the source's (already typed) title verbatim and does not yet
 * reconcile `node.nodeType` against local Roam node-type definitions, so an
 * imported node is recognized as a discourse node only when its title already
 * matches a local node format; active type mapping/creation is deferred.
 *
 * Returns a structured outcome rather than throwing. An already-imported node's
 * stored identity is never dropped: on update the body is replaced first and the
 * identity (carrying the new `sourceModifiedAt`) is written last, so a mid-update
 * failure leaves the prior identity intact and the node re-importable.
 */
export const materializeSharedNode = async (
  node: CrossAppNode,
): Promise<MaterializeResult> => {
  try {
    const title = node.content.direct.value;
    if (!title.trim()) {
      return { status: "failed", error: "Shared node has no title" };
    }

    const importedUid = await findImportedNodeUidByRid(node.sourceNodeRid);
    if (
      importedUid &&
      readImportedSourceIdentity(importedUid)?.sourceModifiedAt ===
        node.sourceModifiedAt
    ) {
      return { status: "skipped", pageUid: importedUid };
    }

    const identity = toImportedSourceIdentity(node);
    const blocks = markdownToRoamBlocks(node.content.full.value);

    if (importedUid) {
      const currentTitle = getPageTitleByPageUid(importedUid);
      if (currentTitle && currentTitle !== title) {
        await window.roamAlphaAPI.updatePage({
          page: { uid: importedUid, title },
        });
      }
      await replacePageBody(importedUid, blocks);
      writeImportedSourceIdentity(importedUid, identity);
      return { status: "updated", pageUid: importedUid };
    }

    const collidingUid = getPageUidByPageTitle(title);
    if (collidingUid) {
      return {
        status: "failed",
        error: `A page titled "${title}" already exists locally and was not imported from this source; skipping to avoid overwriting local content.`,
      };
    }

    const pageUid = await createPage({ title, tree: blocks });
    writeImportedSourceIdentity(pageUid, identity);
    return { status: "created", pageUid };
  } catch (error) {
    return {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
};
