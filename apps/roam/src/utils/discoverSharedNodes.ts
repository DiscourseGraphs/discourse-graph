import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  listGroupSharedCrossAppNodes,
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
    listGroupSharedCrossAppNodes({ client, currentSpaceId }),
    getImportedSourceRids(),
  ]);
  return { ...listing, importedSourceRids };
};
