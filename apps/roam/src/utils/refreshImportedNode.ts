import { getSharedNodeByRid } from "@repo/database/lib/sharedNodes";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { readImportedSourceIdentity } from "./importedSourceIdentity";
import internalError from "./internalError";
import {
  getErrorMessage,
  materializeSharedNode,
} from "./materializeSharedNode";
import { getLoggedInClient } from "./supabaseContext";

const REFRESH_ERROR_TYPE = "Imported node refresh failed";
const REFRESH_ERROR_OPERATION = "refresh-imported-node";

type RefreshImportedNodeResult = {
  success: boolean;
  message: string;
};

export const refreshImportedNode = async ({
  pageUid,
}: {
  pageUid: string;
}): Promise<RefreshImportedNodeResult> => {
  try {
    const title = getPageTitleByPageUid(pageUid);
    const identity = readImportedSourceIdentity(pageUid);
    if (!identity)
      return {
        success: false,
        message: `"${title}" has no stored source identity, so it cannot be refreshed.`,
      };

    const client = await getLoggedInClient();
    if (!client)
      return {
        success: false,
        message: "Could not connect to shared persistence.",
      };

    const sharedNode = await getSharedNodeByRid({
      client,
      rid: identity.sourceNodeRid,
    });
    if (!sharedNode)
      return {
        success: false,
        message: `The source of "${title}" is no longer shared with your groups, so it cannot be refreshed.`,
      };

    const result = await materializeSharedNode({
      client,
      sharedNode,
      force: true,
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
      return { success: false, message: result.error.message };
    }
    if (result.pageUid !== pageUid)
      return {
        success: false,
        message: `A different page ("${getPageTitleByPageUid(result.pageUid)}") is linked to the same source and was refreshed instead.`,
      };
    return {
      success: true,
      message: `Refreshed "${sharedNode.title}" from ${sharedNode.spaceName}.`,
    };
  } catch (error) {
    internalError({
      error,
      type: REFRESH_ERROR_TYPE,
      context: { operation: REFRESH_ERROR_OPERATION, pageUid },
      sendEmail: false,
    });
    return {
      success: false,
      message: `Could not refresh this page: ${getErrorMessage(error)}`,
    };
  }
};
