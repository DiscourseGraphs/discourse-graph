import { contentTypes } from "@repo/content-model";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";
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
  | "create-page"
  | "update-page-title"
  | "replace-page-content"
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

type RoamFromMarkdownApi = {
  data: {
    block: {
      fromMarkdown: (args: {
        location: { "parent-uid": string; order: "last" };
        "markdown-string": string;
      }) => Promise<{ uids: string[] }>;
    };
    page: {
      delete: (args: { page: { uid: string } }) => Promise<void>;
      fromMarkdown: (args: {
        page: { title: string; uid: string };
        "markdown-string": string;
      }) => Promise<{ uid: string }>;
      update: (args: {
        page: { title: string; uid: string };
        "merge-pages": false;
      }) => Promise<void>;
    };
  };
  util: {
    generateUID: () => string;
  };
};

const getRoamFromMarkdownApi = (): RoamFromMarkdownApi =>
  window.roamAlphaAPI as unknown as RoamFromMarkdownApi;

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
  sourceModifiedAt,
  sourceNodeRid,
}: {
  node: CrossAppNode;
} & ImportedSourceIdentity): string | undefined => {
  if (!sourceNodeRid.trim()) return "Source node RID is required";

  const { spaceUri } = ridToSpaceUriAndLocalId(sourceNodeRid);
  if (!spaceUri.startsWith("obsidian:"))
    return `Source node RID '${sourceNodeRid}' is not Obsidian-origin`;

  if (Number.isNaN(Date.parse(sourceModifiedAt)))
    return `Source modified time '${sourceModifiedAt}' is invalid`;

  if (!node.content.direct.value.trim()) return "Source node title is required";

  const contentType = node.content.full.contentType;
  if (
    contentType !== contentTypes.markdown &&
    contentType !== contentTypes.obsidianMarkdown
  )
    return `Unsupported Obsidian full content type '${contentType}'`;

  return undefined;
};

const replacePageContent = async ({
  markdown,
  pageUid,
}: {
  markdown: string;
  pageUid: string;
}): Promise<void> => {
  const children = getShallowTreeByParentUid(pageUid);
  await getRoamFromMarkdownApi().data.block.fromMarkdown({
    location: { "parent-uid": pageUid, order: "last" },
    "markdown-string": markdown,
  });
  await Promise.all(children.map(({ uid }) => deleteBlock(uid)));
};

export const materializeObsidianNode = async ({
  node,
  sourceModifiedAt,
  sourceNodeRid,
}: {
  node: CrossAppNode;
} & ImportedSourceIdentity): Promise<MaterializeObsidianNodeResult> => {
  const identity = { sourceModifiedAt, sourceNodeRid };
  const validationError = validateInput({ node, ...identity });
  if (validationError)
    return failure({
      identity,
      message: validationError,
      stage: "validate-input",
    });

  const title = node.content.direct.value.trim();
  const markdown = node.content.full.value;
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
      await getRoamFromMarkdownApi().data.page.update({
        page: { title, uid: existingPageUid },
        "merge-pages": false,
      });
    } catch (error) {
      return failure({
        error,
        identity,
        message: `Failed to update the Roam page title for '${sourceNodeRid}'`,
        pageUid: existingPageUid,
        stage: "update-page-title",
      });
    }

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

  const pageUid = getRoamFromMarkdownApi().util.generateUID();
  try {
    await getRoamFromMarkdownApi().data.page.fromMarkdown({
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
      await getRoamFromMarkdownApi().data.page.delete({
        page: { uid: pageUid },
      });
    } catch (caughtCleanupError) {
      cleanupError = caughtCleanupError;
    }

    const cleanupMessage = cleanupError
      ? ` Cleanup also failed: ${getErrorMessage(cleanupError)}`
      : " The newly created page was removed.";
    return failure({
      identity,
      message: `Roam content was created, but source identity could not be stored for '${sourceNodeRid}': ${getErrorMessage(error)}.${cleanupMessage}`,
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
