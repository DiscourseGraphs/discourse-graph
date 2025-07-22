// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "runtime";
import {
  createClient,
  type User,
  type PostgrestSingleResponse,
  PostgrestError,
} from "supabase";

type SpaceRecord = {
  id: number;
  name: string;
  url: string;
  platform: string;
};

type SpaceCreationInput = {
  name: string;
  url: string;
  platform: string;
  password: string;
};

// these are duplicates, hence anti-DRY,
// but edge function code cannot use code from the rest of the codebase unless we package it.
// To be considered if it happens more often.

// from packages/ui/src/lib/utils.ts
const spaceAnonUserEmail = (platform: string, space_id: number) =>
  `${platform.toLowerCase()}-${space_id}-anon@database.discoursegraphs.com`;

// from packages/ui/src/lib/supabase/contextFunctions.ts
const asPostgrestFailure = (
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

// from packages/ui/src/lib/supabase/contextFunctions.ts
const spaceValidator = (space: SpaceCreationInput): string | null => {
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

// end duplicates

const processAndGetOrCreateSpace = async (
  supabase: ReturnType<typeof createClient<any, "public", any>>,
  data: SpaceCreationInput,
): Promise<PostgrestSingleResponse<SpaceRecord>> => {
  const { name, url, platform, password } = data;
  const error = spaceValidator(data);
  if (error !== null) return asPostgrestFailure(error, "invalid space");
  const result = await supabase
    .from("Space")
    .upsert(
      {
        name: name.trim(),
        url: url.trim().replace(/\/$/, ""),
        platform,
      },
      {
        onConflict: "url",
        ignoreDuplicates: false,
        count: "estimated",
      },
    )
    .select()
    .single();

  if (result.error) return result;
  const space_id = result.data.id;

  // this is related but each step is idempotent, so con retry w/o transaction
  const email = spaceAnonUserEmail(platform, result.data.id);
  let anonymousUser: User | null = null;
  {
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (
      error &&
      !(
        error.code === "invalid_credentials" ||
        error.message === "Invalid login credentials"
      )
    ) {
      // Handle unexpected errors
      return asPostgrestFailure(error.message, "authentication_error");
    }
    anonymousUser = data.user;
  }
  if (anonymousUser === null) {
    const resultCreateAnonymousUser = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (resultCreateAnonymousUser.error) {
      return {
        count: null,
        status: resultCreateAnonymousUser.error.status || -1,
        statusText: resultCreateAnonymousUser.error.message,
        data: null,
        error: new PostgrestError({
          message: resultCreateAnonymousUser.error.message,
          details:
            typeof resultCreateAnonymousUser.error.cause === "string"
              ? resultCreateAnonymousUser.error.cause
              : "",
          hint: "",
          code: resultCreateAnonymousUser.error.code || "unknown",
        }),
      }; // space created but not its user, try again
    }
    anonymousUser = resultCreateAnonymousUser.data.user as User;
  }
  // NOTE: The next few steps could be done as the new user, except the SpaceAccess
  const anonPlatformUserResult = await supabase
    .from("PlatformAccount")
    .upsert(
      {
        platform,
        account_local_id: email,
        name: `Anonymous of space ${space_id}`,
        agent_type: "anonymous",
        dg_account: anonymousUser.id,
      },
      {
        onConflict: "account_local_id,platform",
        ignoreDuplicates: false,
        count: "estimated",
      },
    )
    .select()
    .single();
  if (anonPlatformUserResult.error) return anonPlatformUserResult;

  const resultAnonUserSpaceAccess = await supabase
    .from("SpaceAccess")
    .upsert(
      {
        space_id,
        account_id: anonPlatformUserResult.data.id,
        editor: true,
      },
      {
        onConflict: "space_id,account_id",
        ignoreDuplicates: false,
        count: "estimated",
      },
    )
    .select()
    .single();
  if (resultAnonUserSpaceAccess.error) return resultAnonUserSpaceAccess; // space created but not connected, try again
  return result;
};

Deno.serve(async (req) => {
  const input = await req.json();
  // TODO: We should check whether the request comes from a vetted source, like
  // the roam or obsidian plugin. A combination of CSRF, headers, etc.
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = createClient<any, "public", any>(url, key);

  const { data, error } = await processAndGetOrCreateSpace(supabase, input);
  if (error) {
    const status = error.code === "invalid space" ? 400 : 500;
    return new Response(JSON.stringify(error), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-space' \
    --header 'Authorization: Bearer <... your supabase anon key ...>' \
    --header 'Content-Type: application/json' \
    --data '{ "url":"https://roamresearch.com/#/app/abc", "name":"abc","platform":"Roam", "password": "abcdefgh" }'

*/
