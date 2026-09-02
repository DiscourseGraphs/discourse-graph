import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  listGroupSharedNodes,
  type SharedNode,
} from "@repo/database/lib/sharedNodes";
import { getImportedSourceRids } from "./importedSourceIdentity";

export const discoverSharedNodes = async ({
  client,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
}): Promise<{
  sharedNodes: SharedNode[];
  importedSourceRids: Set<string>;
}> => {
  const [sharedNodes, importedSourceRids] = await Promise.all([
    listGroupSharedNodes({ client, currentSpaceId }),
    getImportedSourceRids(),
  ]);
  return { sharedNodes, importedSourceRids };
};
