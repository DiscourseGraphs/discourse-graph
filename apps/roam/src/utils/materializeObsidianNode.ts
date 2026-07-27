import { contentTypes, stripFrontmatter } from "@repo/content-model";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import type { Enums } from "@repo/database/dbTypes";
import { isRid } from "@repo/database/lib/rid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import {
  findImportedNodeUidBySourceRid,
  type ImportedSourceIdentity,
  writeImportedSourceIdentity,
} from "./importedSourceIdentity";

type MaterializationStage =
  | "validate-input"
  | "find-imported-node"
  | "title-collision"
  | "create-page"
  | "replace-page-content"
  | "update-page-title"
  | "write-source-identity";

type MaterializationFailure = ImportedSourceIdentity & {
  success: false;
  pageUid?: string;
  error: {
    message: string;
    stage: MaterializationStage;
  };
};

type MaterializationSuccess = ImportedSourceIdentity & {
  success: true;
  action: "created" | "updated";
  pageUid: string;
};

export type MaterializeObsidianNodeResult =
  | MaterializationFailure
  | MaterializationSuccess;

type MaterializeObsidianNodeInput = ImportedSourceIdentity & {
  node: CrossAppNode;
  sourceApp: Enums<"Platform">;
};

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
    update: (args: {
      page: { title: string; uid: string };
      "merge-pages": false;
    }) => Promise<void>;
  };
};

const getRoamMarkdownApi = (): RoamMarkdownApi =>
  window.roamAlphaAPI.data as unknown as RoamMarkdownApi;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const failure = ({
  error,
  identity,
  message,
  pageUid,
  stage,
}: {
  error?: unknown;
  identity: ImportedSourceIdentity;
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

const validateInput = ({
  node,
  sourceApp,
  sourceModifiedAt,
  sourceNodeRid,
}: MaterializeObsidianNodeInput):
  | { error: string }
  | { markdown: string; sourceModifiedAt: string; title: string } => {
  if (!isRid(sourceNodeRid))
    return { error: `Source node RID '${sourceNodeRid}' is not a RID` };

  if (sourceApp !== "Obsidian")
    return { error: `Source app '${sourceApp}' is not Obsidian` };

  const modifiedAt = new Date(sourceModifiedAt);
  if (Number.isNaN(modifiedAt.getTime()))
    return { error: `Source modified time '${sourceModifiedAt}' is invalid` };

  const title = node.content.direct.value.trim();
  if (!title) return { error: "Source node title is required" };

  const full = node.content.full;
  if (!full) return { error: "Source node has no full content to materialize" };

  if (full.contentType !== contentTypes.obsidianMarkdown)
    return {
      error: `Unsupported Obsidian full content type '${full.contentType}'`,
    };

  const markdown = stripFrontmatter(full.value).trim();
  if (!markdown)
    return {
      error: "Source node has no markdown body outside its frontmatter",
    };

  return { markdown, sourceModifiedAt: modifiedAt.toISOString(), title };
};

const replacePageContent = async ({
  markdown,
  pageUid,
}: {
  markdown: string;
  pageUid: string;
}): Promise<void> => {
  const previousChildren = getShallowTreeByParentUid(pageUid);
  await getRoamMarkdownApi().block.fromMarkdown({
    location: { "parent-uid": pageUid, order: "last" },
    "markdown-string": markdown,
  });
  await Promise.all(previousChildren.map(({ uid }) => deleteBlock(uid)));
};

export const materializeObsidianNode = async ({
  node,
  sourceApp,
  sourceModifiedAt,
  sourceNodeRid,
}: MaterializeObsidianNodeInput): Promise<MaterializeObsidianNodeResult> => {
  const validated = validateInput({
    node,
    sourceApp,
    sourceModifiedAt,
    sourceNodeRid,
  });
  if ("error" in validated)
    return failure({
      identity: { sourceModifiedAt, sourceNodeRid },
      message: validated.error,
      stage: "validate-input",
    });

  const { markdown, title } = validated;
  const identity: ImportedSourceIdentity = {
    sourceModifiedAt: validated.sourceModifiedAt,
    sourceNodeRid,
  };

  let existingPageUid: string | null;
  try {
    existingPageUid = await findImportedNodeUidBySourceRid(sourceNodeRid);
  } catch (error) {
    return failure({
      error,
      identity,
      message: `Failed to look up imported Roam node for '${sourceNodeRid}'`,
      stage: "find-imported-node",
    });
  }

  if (existingPageUid) {
    try {
      await replacePageContent({ markdown, pageUid: existingPageUid });
    } catch (error) {
      return failure({
        error,
        identity,
        message: `Failed to replace Roam content for '${sourceNodeRid}'`,
        pageUid: existingPageUid,
        stage: "replace-page-content",
      });
    }

    try {
      await getRoamMarkdownApi().page.update({
        page: { title, uid: existingPageUid },
        "merge-pages": false,
      });
    } catch (error) {
      return failure({
        error,
        identity,
        message: `Content was replaced, but the Roam page title could not be updated for '${sourceNodeRid}'`,
        pageUid: existingPageUid,
        stage: "update-page-title",
      });
    }

    try {
      await writeImportedSourceIdentity({
        pageUid: existingPageUid,
        ...identity,
      });
    } catch (error) {
      return failure({
        error,
        identity,
        message: `Content was updated, but source identity could not be refreshed for '${sourceNodeRid}'`,
        pageUid: existingPageUid,
        stage: "write-source-identity",
      });
    }

    return {
      ...identity,
      success: true,
      action: "updated",
      pageUid: existingPageUid,
    };
  }

  if (getPageUidByPageTitle(title))
    return failure({
      identity,
      message: `A Roam page titled '${title}' already exists and was not imported from '${sourceNodeRid}'`,
      stage: "title-collision",
    });

  const pageUid = window.roamAlphaAPI.util.generateUID();
  try {
    await getRoamMarkdownApi().page.fromMarkdown({
      page: { title, uid: pageUid },
      "markdown-string": markdown,
    });
  } catch (error) {
    return failure({
      error,
      identity,
      message: `Failed to create a Roam page for '${sourceNodeRid}'`,
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
        ? `Roam content was created for '${sourceNodeRid}' and could not be removed after source identity failed to store (cleanup error: ${getErrorMessage(cleanupError)})`
        : `Roam content was created and then removed because source identity could not be stored for '${sourceNodeRid}'`,
      ...(cleanupError ? { pageUid } : {}),
      stage: "write-source-identity",
    });
  }

  return {
    ...identity,
    success: true,
    action: "created",
    pageUid,
  };
};
