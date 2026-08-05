import {
  contentTypes,
  stripFrontmatter,
  stripTitleHeading,
  trimBlankLines,
} from "@repo/content-model";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { isRid } from "@repo/database/lib/rid";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import {
  findImportedNodeUidBySourceRid,
  readImportedSourceIdentity,
  writeImportedSourceIdentity,
  type ImportedSourceIdentity,
} from "./importedSourceIdentity";

type MaterializationStage =
  | "validate-input"
  | "fetch-content"
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

const getRoamMarkdownApi = (): RoamMarkdownApi =>
  window.roamAlphaAPI.data as unknown as RoamMarkdownApi;

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

const createImportedPage = async ({
  identity,
  markdown,
  title,
}: {
  identity: SourceIdentity;
  markdown: string;
  title: string;
}): Promise<MaterializeSharedNodeResult> => {
  if (getPageUidByPageTitle(title))
    return failure({
      identity,
      message: `A page titled "${title}" already exists and was not imported from "${identity.sourceNodeRid}". Rename or remove that page, then import again`,
      stage: "title-collision",
    });

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
  if (needsRename && getPageUidByPageTitle(title))
    return failure({
      identity,
      message: `Cannot rename the imported page "${localTitle}" to "${title}": another page already has that title. Rename or remove that page, then import again`,
      pageUid,
      stage: "title-collision",
    });

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
}: {
  client: DGSupabaseClient;
  sharedNode: SharedNode;
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

  return importedPageUid
    ? updateImportedPage({
        identity,
        markdown: content.markdown,
        pageUid: importedPageUid,
        title: validated.title,
      })
    : createImportedPage({
        identity,
        markdown: content.markdown,
        title: validated.title,
      });
};
