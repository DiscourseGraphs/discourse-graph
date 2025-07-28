import { Enums, Tables, TablesInsert } from "@repo/database/types.gen";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { FunctionsResponse } from "@supabase/functions-js";
import { nextApiRoot } from "@repo/ui/lib/execContext";
import {
  createClient,
  type DGSupabaseClient,
} from "@repo/ui/lib/supabase/client";

export const spaceAnonUserEmail = (platform: string, space_id: number) =>
  `${platform.toLowerCase()}-${space_id}-anon@database.discoursegraphs.com`;

type Platform = Enums<"Platform">;

const baseUrl = nextApiRoot() + "/supabase";

type SpaceDataInput = TablesInsert<"Space">;
export type SpaceRecord = Tables<"Space">;

export type SpaceCreationInput = SpaceDataInput & { password: string };

export const asPostgrestFailure = (
  message: string,
  code: string,
  status: number = 400,
): PostgrestSingleResponse<any> => {
  return {
    data: null,
    error: {
      message,
      code,
      details: "",
      hint: "",
      name: code,
    },
    count: null,
    statusText: code,
    status,
  };
};

export const spaceValidator = (space: SpaceCreationInput): string | null => {
  if (!space || typeof space !== "object")
    return "Invalid request body: expected a JSON object.";
  const { name, url, platform, password } = space;

  if (!name || typeof name !== "string" || name.trim() === "")
    return "Missing or invalid name.";
  if (!url || typeof url !== "string" || url.trim() === "")
    return "Missing or invalid URL.";
  if (platform === undefined || !["Roam", "Obsidian"].includes(platform))
    return "Missing or invalid platform.";
  if (!password || typeof password !== "string" || password.length < 8)
    return "password must be at least 8 characters";
  return null;
};

export const fetchOrCreateSpaceIndirect = async (
  input: SpaceCreationInput,
): Promise<PostgrestSingleResponse<SpaceRecord>> => {
  // This is another network hop, but allows for nextjs to check for csrf
  // TODO: check for CSRF or a shared secret in supabase edge function?
  const response = await fetch(baseUrl + "/space", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      `Platform API failed: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }
  const data = await response.json();
  return {
    data,
    error: null,
    count: 1,
    status: 200,
    statusText: "OK",
  };
};

export const fetchOrCreateSpaceDirect = async (
  data: SpaceCreationInput,
): Promise<PostgrestSingleResponse<SpaceRecord>> => {
  const error = spaceValidator(data);
  if (error !== null) return asPostgrestFailure(error, "invalid space");
  data.url = data.url.trim().replace(/\/$/, "");
  console.log("data", data);

  const supabase = createClient();
  const result = await supabase
    .from("Space")
    .select()
    .eq("url", data.url)
    .maybeSingle();
  if (result.data !== null)
    return result as PostgrestSingleResponse<SpaceRecord>;
  // If it does not exist, create it
  const result2: FunctionsResponse<SpaceRecord> =
    await supabase.functions.invoke("create-space", {
      body: data,
    });

  if (result2.data === null) {
    return asPostgrestFailure(
      JSON.stringify(result2.error),
      "Failed to create space",
    );
  }
  return {
    data: result2.data,
    error: null,
    count: 1,
    status: 200,
    statusText: "OK",
  };
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

  if (result.error) throw Error(result.error.message);
  return result.data;
};
