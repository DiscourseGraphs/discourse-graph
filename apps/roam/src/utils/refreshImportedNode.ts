import { getSharedNodeByRid } from "@repo/database/lib/sharedNodes";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { readImportedSourceIdentity } from "./importedSourceIdentity";
import internalError from "./internalError";
import { getErrorMessage } from "./getErrorMessage";
import { materializeSharedNode } from "./materializeSharedNode";
import { resolveSharedNodeTypes } from "./resolveSharedNodeTypes";
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import { importSharedRelations } from "./importSharedRelations";
import type { DGSupabaseClient } from "@repo/database/lib/client";

export const REFRESH_ERROR_TYPE = "Imported node refresh failed";
const REFRESH_ERROR_OPERATION = "refresh-imported-node";

type RefreshImportedNodeResult = {
  status: "refreshed" | "skipped" | "failed";
  message: string;
  warning?: string;
};

// A relation published after both of its ends were imported arrives only with a later
// import or refresh. Returns a warning when some relations could not be imported.
export const importRelationsAfterRefresh = async (
  client: DGSupabaseClient,
): Promise<string | undefined> => {
  try {
    const context = await getSupabaseContext();
    if (!context)
      return "Could not import relations: could not connect to shared persistence.";
    // Skipped relations are not reported: they need not involve the refreshed node.
    const { failures } = await importSharedRelations(client, context.spaceId);
    if (failures.length === 0) return undefined;
    return failures.length === 1
      ? "1 relation could not be imported."
      : `${failures.length} relations could not be imported.`;
  } catch (error) {
    internalError({
      error,
      type: REFRESH_ERROR_TYPE,
      context: { operation: "import-relations-after-refresh" },
      sendEmail: false,
    });
    return `Could not import relations: ${getErrorMessage(error)}`;
  }
};

const joinWarnings = (...warnings: (string | undefined)[]) => {
  const present = warnings.filter((w) => w !== undefined);
  return present.length > 0 ? { warning: present.join(" ") } : {};
};

// Refresh-all passes `importRelations: false` and imports relations once at the end.
export const refreshImportedNode = async ({
  pageUid,
  force,
  importRelations = true,
}: {
  pageUid: string;
  force: boolean;
  importRelations?: boolean;
}): Promise<RefreshImportedNodeResult> => {
  try {
    const title = getPageTitleByPageUid(pageUid);
    const identity = readImportedSourceIdentity(pageUid);
    if (!identity)
      return {
        status: "failed",
        message: `"${title}" has no stored source identity, so it cannot be refreshed.`,
      };

    const client = await getLoggedInClient();
    if (!client)
      return {
        status: "failed",
        message: "Could not connect to shared persistence.",
      };

    const sharedNode = await getSharedNodeByRid({
      client,
      rid: identity.sourceNodeRid,
    });
    if (!sharedNode)
      return {
        status: "failed",
        message: `The source of "${title}" is no longer shared with your groups, so it cannot be refreshed.`,
      };

    const nodeTypesBySchemaId = await resolveSharedNodeTypes({
      client,
      sharedNodes: [sharedNode],
    });
    const result = await materializeSharedNode({
      client,
      sharedNode,
      nodeType: nodeTypesBySchemaId.get(sharedNode.schemaId),
      force,
    });
    if (!result.success) {
      internalError({
        error: new Error(result.error.message),
        type: REFRESH_ERROR_TYPE,
        context: {
          operation: REFRESH_ERROR_OPERATION,
          pageUid,
          stage: result.error.stage,
        },
        sendEmail: false,
      });
      return { status: "failed", message: result.error.message };
    }
    if (result.pageUid !== pageUid)
      return {
        status: "failed",
        message: `A different page ("${getPageTitleByPageUid(result.pageUid)}") is linked to the same source and was refreshed instead.`,
      };
    const relationWarning = importRelations
      ? await importRelationsAfterRefresh(client)
      : undefined;
    if (result.action === "skipped")
      return {
        status: "skipped",
        message: `"${sharedNode.title}" is already up to date.`,
        ...joinWarnings(relationWarning),
      };
    return {
      status: "refreshed",
      message: `Refreshed "${sharedNode.title}" from ${sharedNode.spaceName}.`,
      ...joinWarnings(result.warning, relationWarning),
    };
  } catch (error) {
    internalError({
      error,
      type: REFRESH_ERROR_TYPE,
      context: { operation: REFRESH_ERROR_OPERATION, pageUid },
      sendEmail: false,
    });
    return {
      status: "failed",
      message: `Could not refresh this page: ${getErrorMessage(error)}`,
    };
  }
};
