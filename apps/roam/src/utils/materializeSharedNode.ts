import {
  contentTypes,
  stripFrontmatter,
  stripTitleHeading,
  trimBlankLines,
} from "@repo/content-model";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { decorateTitle } from "@repo/database/lib/decorateTitle";
import { isRid } from "@repo/database/lib/rid";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import type { DiscourseNode } from "./getDiscourseNodes";
import {
  findImportedNodeUidBySourceRid,
  readImportedSourceIdentity,
  writeImportedSourceIdentity,
  type ImportedSourceIdentity,
} from "./importedSourceIdentity";
import { getErrorMessage } from "./getErrorMessage";
import { importNodeAssets, type AssetImportReport } from "./importNodeAssets";

type MaterializationStage =
  | "validate-input"
  | "fetch-content"
  | "copy-assets"
  | "find-imported-node"
  | "title-collision"
  | "create-page"
  | "replace-page-content"
  | "update-page-title"
  | "write-source-identity";

type SourceIdentity = {
  sourceModifiedAt: string;
  sourceNodeRid: string;
};

type MaterializationFailure = SourceIdentity & {
  success: false;
  pageUid?: string;
  error: {
    message: string;
    stage: MaterializationStage;
  };
};

type MaterializationSuccess = SourceIdentity & {
  success: true;
  action: "created" | "updated" | "skipped";
  pageUid: string;
  /**
   * What the asset stage did. Absent on a skipped import, which replaces no content and
   * so copies nothing. An asset that could not be copied appears here rather than
   * failing the node.
   *
   * Nothing reads it yet, and that is the intended state: `importSharedNodes` and
   * `refreshImportedNode` both discard it, so a degraded asset is currently invisible to
   * the user. Surfacing cross-app failures is ENG-1877's work, and this field exists so
   * that ticket has a shape to read rather than a behaviour to add first.
   */
  assets?: AssetImportReport;
};

export type MaterializeSharedNodeResult =
  | MaterializationFailure
  | MaterializationSuccess;

type RoamMarkdownApi = {
  block: {
    fromMarkdown: (args: {
      location: { "parent-uid": string; order: "last" };
      "markdown-string": string;
    }) => Promise<void>;
  };
  page: {
    fromMarkdown: (args: {
      page: { title: string; uid: string };
      "markdown-string": string;
    }) => Promise<void>;
  };
};

export const getRoamMarkdownApi = (): RoamMarkdownApi =>
  window.roamAlphaAPI.data as unknown as RoamMarkdownApi;

const isImportUpToDate = ({
  sourceModifiedAt,
  storedModifiedAt,
}: {
  sourceModifiedAt: string;
  storedModifiedAt: string;
}): boolean => {
  const storedTime = Date.parse(storedModifiedAt);
  return (
    !Number.isNaN(storedTime) && storedTime >= Date.parse(sourceModifiedAt)
  );
};

const failure = ({
  error,
  identity,
  message,
  pageUid,
  stage,
}: {
  error?: unknown;
  identity: SourceIdentity;
  message: string;
  pageUid?: string;
  stage: MaterializationStage;
}): MaterializationFailure => ({
  ...identity,
  success: false,
  ...(pageUid ? { pageUid } : {}),
  error: {
    message: error ? `${message}: ${getErrorMessage(error)}` : message,
    stage,
  },
});

const validateSharedNode = (
  sharedNode: SharedNode,
): { error: string } | { sourceModifiedAt: string; title: string } => {
  if (!isRid(sharedNode.rid))
    return { error: `Source node RID "${sharedNode.rid}" is not a RID` };

  const modifiedAt = new Date(sharedNode.lastModified);
  if (Number.isNaN(modifiedAt.getTime()))
    return {
      error: `Source modified time "${sharedNode.lastModified}" is invalid`,
    };

  const title = sharedNode.title.trim();
  if (!title) return { error: "Source node title is required" };

  return { sourceModifiedAt: modifiedAt.toISOString(), title };
};

const fetchFullMarkdown = async ({
  client,
  sharedNode,
}: {
  client: DGSupabaseClient;
  sharedNode: SharedNode;
}): Promise<{ markdown: string } | { error: string }> => {
  const { data, error } = await client
    .from("my_contents")
    .select("text, content_type")
    .eq("space_id", sharedNode.spaceId)
    .eq("source_local_id", sharedNode.sourceLocalId)
    .eq("variant", "full")
    .eq("original", true)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data?.text) return { markdown: "" };
  const expectedContentType =
    sharedNode.platform === "Roam"
      ? contentTypes.roamMarkdown
      : contentTypes.obsidianMarkdown;
  if (data.content_type !== expectedContentType)
    return {
      error: `Unsupported full content type "${data.content_type}" — expected "${expectedContentType}"`,
    };
  const withoutPreamble =
    sharedNode.platform === "Roam"
      ? stripTitleHeading({ markdown: data.text, title: sharedNode.title })
      : stripFrontmatter(data.text);
  const markdown = trimBlankLines(withoutPreamble);
  return { markdown: markdown.trim() ? markdown : "" };
};

/**
 * The title check both import paths make, extracted so materialization can make it before
 * anything irrevocable happens.
 *
 * A collision imports nothing and tells the user to rename the other page, which reads as
 * a clean no-op — but copying an asset into Roam storage cannot be undone, and Roam
 * exposes no way to list or delete what was uploaded (see `mirrorAssetToRoamStorage`).
 * Running the asset stage first would leave a failed import charging the user's storage
 * for blobs nothing references and nothing can find. The check is two synchronous reads,
 * so making it early costs nothing.
 *
 * Still made again inside the two paths: they are exported behaviour in their own right,
 * and the message belongs with the check rather than being duplicated at the call site.
 */
const titleCollisionFailure = ({
  identity,
  importedPageUid,
  title,
}: {
  identity: SourceIdentity;
  importedPageUid?: string;
  title: string;
}): MaterializationFailure | undefined => {
  if (!importedPageUid)
    return getPageUidByPageTitle(title)
      ? failure({
          identity,
          message: `A page titled "${title}" already exists and was not imported from "${identity.sourceNodeRid}". Rename or remove that page, then import again`,
          stage: "title-collision",
        })
      : undefined;

  const localTitle = getPageTitleByPageUid(importedPageUid);
  if (localTitle === title || !getPageUidByPageTitle(title)) return undefined;
  return failure({
    identity,
    message: `Cannot rename the imported page "${localTitle}" to "${title}": another page already has that title. Rename or remove that page, then import again`,
    pageUid: importedPageUid,
    stage: "title-collision",
  });
};

const createImportedPage = async ({
  identity,
  markdown,
  title,
}: {
  identity: SourceIdentity;
  markdown: string;
  title: string;
}): Promise<MaterializeSharedNodeResult> => {
  const collision = titleCollisionFailure({ identity, title });
  if (collision) return collision;

  const pageUid = window.roamAlphaAPI.util.generateUID();
  try {
    if (markdown) {
      await getRoamMarkdownApi().page.fromMarkdown({
        page: { title, uid: pageUid },
        "markdown-string": markdown,
      });
    } else {
      await window.roamAlphaAPI.data.page.create({
        page: { title, uid: pageUid },
      });
    }
  } catch (error) {
    return failure({
      error,
      identity,
      message: `Failed to create a Roam page for "${title}"`,
      stage: "create-page",
    });
  }

  try {
    await writeImportedSourceIdentity({ pageUid, ...identity });
  } catch (error) {
    let cleanupError: unknown;
    try {
      await window.roamAlphaAPI.data.page.delete({ page: { uid: pageUid } });
    } catch (caughtCleanupError) {
      cleanupError = caughtCleanupError;
    }

    return failure({
      error,
      identity,
      message: cleanupError
        ? `Created "${title}" but could not store its source identity, and removing the page failed too (${getErrorMessage(cleanupError)}) — delete the page manually before re-importing`
        : `Created "${title}" and removed it again because its source identity could not be stored`,
      ...(cleanupError ? { pageUid } : {}),
      stage: "write-source-identity",
    });
  }

  return { ...identity, success: true, action: "created", pageUid };
};

const updateImportedPage = async ({
  identity,
  markdown,
  pageUid,
  title,
}: {
  identity: SourceIdentity;
  markdown: string;
  pageUid: string;
  title: string;
}): Promise<MaterializeSharedNodeResult> => {
  const localTitle = getPageTitleByPageUid(pageUid);
  const needsRename = localTitle !== title;
  const collision = titleCollisionFailure({
    identity,
    importedPageUid: pageUid,
    title,
  });
  if (collision) return collision;

  try {
    const previousChildren = getShallowTreeByParentUid(pageUid);
    if (markdown) {
      await getRoamMarkdownApi().block.fromMarkdown({
        location: { "parent-uid": pageUid, order: "last" },
        "markdown-string": markdown,
      });
    }
    await Promise.all(previousChildren.map(({ uid }) => deleteBlock(uid)));
  } catch (error) {
    return failure({
      error,
      identity,
      message: `Failed to replace the content of "${localTitle}"`,
      pageUid,
      stage: "replace-page-content",
    });
  }

  if (needsRename) {
    try {
      await window.roamAlphaAPI.updatePage({ page: { uid: pageUid, title } });
    } catch (error) {
      return failure({
        error,
        identity,
        message: `Content of "${localTitle}" was replaced, but the page could not be renamed to "${title}"`,
        pageUid,
        stage: "update-page-title",
      });
    }
  }

  try {
    await writeImportedSourceIdentity({ pageUid, ...identity });
  } catch (error) {
    return failure({
      error,
      identity,
      message: `Content of "${title}" was replaced, but its source identity could not be refreshed`,
      pageUid,
      stage: "write-source-identity",
    });
  }

  return { ...identity, success: true, action: "updated", pageUid };
};

export const materializeSharedNode = async ({
  client,
  sharedNode,
  nodeType,
  force = false,
}: {
  client: DGSupabaseClient;
  sharedNode: SharedNode;
  nodeType?: Pick<DiscourseNode, "format">;
  force?: boolean;
}): Promise<MaterializeSharedNodeResult> => {
  const rawIdentity: SourceIdentity = {
    sourceModifiedAt: sharedNode.lastModified,
    sourceNodeRid: sharedNode.rid,
  };

  const validated = validateSharedNode(sharedNode);
  if ("error" in validated)
    return failure({
      identity: rawIdentity,
      message: validated.error,
      stage: "validate-input",
    });

  const identity: SourceIdentity = {
    sourceModifiedAt: validated.sourceModifiedAt,
    sourceNodeRid: sharedNode.rid,
  };
  const pageTitle =
    (sharedNode.coreTitle && nodeType
      ? decorateTitle(nodeType.format, sharedNode.coreTitle)
      : null) ?? validated.title;

  let importedPageUid: string | null;
  let storedIdentity: ImportedSourceIdentity | undefined;
  try {
    importedPageUid = await findImportedNodeUidBySourceRid(sharedNode.rid);
    storedIdentity = importedPageUid
      ? readImportedSourceIdentity(importedPageUid)
      : undefined;
  } catch (error) {
    return failure({
      error,
      identity,
      message: `Failed to look up an existing import of "${sharedNode.title}"`,
      stage: "find-imported-node",
    });
  }

  if (
    !force &&
    importedPageUid &&
    storedIdentity &&
    isImportUpToDate({
      sourceModifiedAt: identity.sourceModifiedAt,
      storedModifiedAt: storedIdentity.sourceModifiedAt,
    })
  )
    return {
      ...identity,
      success: true,
      action: "skipped",
      pageUid: importedPageUid,
    };

  const content = await fetchFullMarkdown({ client, sharedNode }).catch(
    (error: unknown) => ({ error: getErrorMessage(error) }),
  );
  if ("error" in content)
    return failure({
      identity,
      message: `Could not fetch the content of "${sharedNode.title}" from "${sharedNode.spaceName}": ${content.error}`,
      stage: "fetch-content",
    });

  // Before the assets, because a collision imports nothing while an upload cannot be
  // taken back. Both import paths check again; this one exists to keep a rejected import
  // from spending the user's Roam storage on blobs no page will reference.
  const collision = titleCollisionFailure({
    identity,
    importedPageUid: importedPageUid ?? undefined,
    title: validated.title,
  });
  if (collision) return collision;

  // Between fetching the content and replacing the page with it: the markdown written
  // below is the rewritten one, and the copies it points at exist by then.
  //
  // Guarded like every other awaited step. The stage reports its own per-asset failures
  // and catches its reference query, so nothing known throws out of it today; what this
  // covers is the residue — the link rewrite, and whatever a later edit adds outside
  // those guards. Without it such a throw leaves `materializeSharedNode` with a
  // stage-less rejection, and its callers can only report that as an unexplained error.
  const assets = await importNodeAssets({
    client,
    sharedNode,
    markdown: content.markdown,
  }).catch((error: unknown) => ({ error }));
  if ("error" in assets)
    return failure({
      error: assets.error,
      identity,
      message: `Failed to copy the assets of "${sharedNode.title}"`,
      stage: "copy-assets",
    });
  const { markdown, report } = assets;

  const result = await (importedPageUid
    ? updateImportedPage({
        identity,
        markdown,
        pageUid: importedPageUid,
        title: pageTitle,
      })
    : createImportedPage({
        identity,
        markdown,
        title: pageTitle,
      }));

  // Carried on success only. A node that failed to import has a stage of its own to
  // report, and the assets it did or did not copy are not what the reader needs.
  return result.success ? { ...result, assets: report } : result;
};
