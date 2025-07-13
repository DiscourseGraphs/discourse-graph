import { Enums } from "@repo/database/types.gen.ts";
import { nextApiRoot, spaceAnonUserEmail } from "@repo/ui/lib/utils";
import {
  createClient,
  type DGSupabaseClient,
} from "@repo/ui/lib/supabase/client";

type Platform = Enums<"Platform">;

const baseUrl = nextApiRoot() + "/supabase";

export const fetchOrCreateSpaceId = async (data: {
  password: string;
  url: string;
  name: string;
  platform: Platform;
}): Promise<number> => {
  const response = await fetch(baseUrl + "/space", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  if (!response.ok)
    throw new Error(
      `Platform API failed: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  const space = await response.json();
  if (typeof space.id !== "number") throw new Error("API did not return space");
  return space.id;
};

export const createLoggedInClient = async (
  platform: Platform,
  spaceId: number,
  password: string,
): Promise<DGSupabaseClient> => {
  const loggedInClient: DGSupabaseClient = createClient();
  const { error } = await loggedInClient.auth.signInWithPassword({
    email: spaceAnonUserEmail(platform, spaceId),
    password: password,
  });
  if (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
  return loggedInClient;
};

export const fetchOrCreatePlatformAccount = async ({
  platform,
  accountLocalId,
  name,
  email,
  spaceId,
  password,
}: {
  platform: Platform;
  accountLocalId: string;
  name: string;
  email: string | undefined;
  spaceId: number;
  password: string;
}): Promise<number> => {
  const supabase = await createLoggedInClient(platform, spaceId, password);

  const result = await supabase.rpc("create_account_in_space", {
    space_id_: spaceId,
    account_local_id_: accountLocalId,
    name_: name,
    email_: email,
  });

  if (result.error) throw Error(result.error.message); // account created but not connected, try again
  return result.data;
};
