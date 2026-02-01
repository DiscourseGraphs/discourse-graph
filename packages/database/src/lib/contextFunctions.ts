import { createClient } from "@supabase/supabase-js";
import type { Database, Enums, Tables, TablesInsert } from "@repo/database/dbTypes";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import type { FunctionsResponse } from "@supabase/functions-js";
import { nextApiRoot } from "@repo/utils/execContext";
import type { DGSupabaseClient } from "@repo/database/lib/client";

export const spaceAnonUserEmail = (platform: string, spaceId: number) =>
  `${platform.toLowerCase()}-${spaceId}-anon@database.discoursegraphs.com`;

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

export class FatalError extends Error {}

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
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(
      `Platform API failed: ${response.status} ${response.statusText} ${await response.text()}`,
    );
  }
  const data = await response.json() as SpaceRecord;
  return {
    data,
    error: null,
    count: 1,
    status: 200,
    statusText: "OK",
  };
};

let client: DGSupabaseClient | undefined = undefined;
let lastStorageKey: string | undefined = undefined;

// let's avoid exporting this, and always use the createLoggedInClient
// to ensure we never have conflict between multiple clients
const createSingletonClient = (uniqueKey: string): DGSupabaseClient | null => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new FatalError("Missing required Supabase environment variables");
  }
  if (lastStorageKey !== undefined && lastStorageKey !== uniqueKey) {
    console.error("Changed storage key")
    // I.e. working on a new vault. Should never happen.
    // Break singleton pattern in that edge case.
    client = undefined;
  }
  if (client === undefined) {
      client = createClient<Database, "public">(url, key, {auth: {storageKey: `sb-${uniqueKey}-auth-token`}});
      if (client) {
        lastStorageKey = uniqueKey;
      }
  }
  return client;
};

export const fetchOrCreateSpaceDirect = async (
  data: SpaceCreationInput,
): Promise<PostgrestSingleResponse<SpaceRecord>> => {
  const error = spaceValidator(data);
  if (error !== null) return asPostgrestFailure(error, "invalid space");
  data.url = data.url.trim().replace(/\/$/, "");
  const urlSlug = data.url.replaceAll(/\W/g,"");
  const supabase = createSingletonClient(urlSlug);
  if (!supabase) return asPostgrestFailure("No database", "");
  const session = await supabase.auth.getSession();
  if (session.data.session) {
    // already authenticated, let's see if space exists
    const result = await supabase
      .from("Space")
      .select()
      .eq("url", data.url)
      .maybeSingle();
    if (result.error)
      return result;
    if (result.data !== null)
      return result as PostgrestSingleResponse<SpaceRecord>;
    // space does not exist, or not visible from this account;
    // logout to be sure
    console.warn(`Creating a space while already logged in as ${session.data.session.user.email}; logging out`);
    await supabase.auth.signOut();
  }
  // If it does not exist, create it
  const result2: FunctionsResponse<SpaceRecord> =
    await supabase.functions.invoke("create-space", {
      body: data,
    });

  if (result2.data === null) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    let error: string = (result2.error?.message as string | undefined) || "";
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (result2.error?.context?.body)
      try {
        // eslint-disable-next-line
        error += await new Response(result2.error.context.body).text();
      } catch (err) {
        // could not parse, not important
      }
    return asPostgrestFailure(error, "Failed to create space");
  }
  return {
    data: result2.data,
    error: null,
    count: 1,
    status: 200,
    statusText: "OK",
  };
};

// After the space is created, use this to get a session.
export const createLoggedInClient = async ({
  platform,
  spaceId,
  password,
}: {
  platform: Platform;
  spaceId: number;
  password: string;
}): Promise<DGSupabaseClient | null> => {
  if (!client) return null;
  const email = spaceAnonUserEmail(platform, spaceId);
  const session = await client.auth.getSession();
  if (session.data.session) {
    if (session.data.session.user.email === email)
      return client;  // already logged in
    else {
      console.warn("Email crosstalk")
      await client.auth.signOut();
    }
  }
  const { error } = await client.auth.signInWithPassword({
    email,
    password: password,
  });
  if (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
  return client;
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
  const supabase = await createLoggedInClient({
    platform,
    spaceId,
    password,
  });
  if (!supabase) throw Error("Missing database connection");

  const result = await supabase.rpc("create_account_in_space", {
    space_id_: spaceId,
    account_local_id_: accountLocalId,
    name_: name,
    email_: email,
  });

  if (result.error) throw Error(result.error.message);
  return result.data;
};
