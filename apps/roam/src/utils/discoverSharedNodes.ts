import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  listGroupSharedNodes,
  type SharedNodeListing,
} from "@repo/database/lib/sharedNodes";
import { getImportedSourceRids } from "./importedSourceIdentity";

export const discoverSharedNodes = async ({
  client,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
}): Promise<
  SharedNodeListing & {
    importedSourceRids: Set<string>;
  }
> => {
  const [listing, importedSourceRids] = await Promise.all([
    listGroupSharedNodes({ client, currentSpaceId }),
    getImportedSourceRids(),
  ]);
  return { ...listing, importedSourceRids };
};
