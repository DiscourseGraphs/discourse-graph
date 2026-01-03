// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "@supabase/functions-js/edge-runtime";
import {
  createClient,
  type User,
  type PostgrestSingleResponse,
  PostgrestError,
} from "@supabase/supabase-js";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type {
  SpaceRecord,
  SpaceCreationInput,
} from "@repo/database/lib/contextFunctions";

// Importing local functions works with deno compile, but fails in the edge context.
// We may consider packaging these functions in the future.
// import {
//   spaceAnonUserEmail,
//   asPostgrestFailure,
//   spaceValidator,
// } from "@repo/database/lib/contextFunctions";

// For now, duplicating the functions from @repo/database/lib/contextFunctions

const spaceAnonUserEmail = (platform: string, space_id: number) =>
  `${platform.toLowerCase()}-${space_id}-anon@database.discoursegraphs.com`;

const asPostgrestFailure = <T>(
  message: string,
  code: string,
  status: number = 400,
): PostgrestSingleResponse<T> => {
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
  supabase: DGSupabaseClient,
  data: SpaceCreationInput,
): Promise<PostgrestSingleResponse<SpaceRecord>> => {
  const { name, url, platform, password } = data;
  const error = spaceValidator(data);
  if (error !== null)
    return asPostgrestFailure<SpaceRecord>(error, "invalid space");
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
    await supabase.auth.signOut({ scope: "local" });
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
        account_uid: anonymousUser.id,
        editor: true,
      },
      {
        onConflict: "account_uid,space_id",
        ignoreDuplicates: false,
        count: "estimated",
      },
    )
    .select()
    .single();
  if (resultAnonUserSpaceAccess.error) return resultAnonUserSpaceAccess; // space created but not connected, try again
  return result;
};

// The following lines are duplicated from apps/website/app/utils/llm/cors.ts
const allowedOrigins = ["https://roamresearch.com", "http://localhost:3000"];

const isVercelPreviewUrl = (origin: string): boolean =>
  /^https:\/\/.*-discourse-graph-[a-z0-9]+\.vercel\.app$/.test(origin);

const isAllowedOrigin = (origin: string): boolean =>
  allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
  isVercelPreviewUrl(origin);

// @ts-ignore Deno is not visible to the IDE
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const originIsAllowed = origin && isAllowedOrigin(origin);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(originIsAllowed ? { "Access-Control-Allow-Origin": origin } : {}),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, x-vercel-protection-bypass, x-client-info, apikey",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  const input = await req.json();
  // @ts-ignore Deno is not visible to the IDE
  const url = Deno.env.get("SUPABASE_URL");
  // @ts-ignore Deno is not visible to the IDE
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return new Response("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  // note: If we wanted this to be bound by permissions, we'd set the following options:
  // { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  // But the point here is to bypass RLS
  const supabase: DGSupabaseClient = createClient(url, key);

  const { data, error } = await processAndGetOrCreateSpace(supabase, input);
  if (error) {
    const status = error.code === "invalid space" ? 400 : 500;
    return new Response(JSON.stringify(error), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });

  if (originIsAllowed) {
    res.headers.set("Access-Control-Allow-Origin", origin as string);
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-vercel-protection-bypass, x-client-info, apikey",
    );
  }

  return res;
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-space' \
    --header 'Authorization: Bearer <... your supabase anon key ...>' \
    --header 'Content-Type: application/json' \
    --data '{ "url":"https://roamresearch.com/#/app/abc", "name":"abc","platform":"Roam", "password": "abcdefgh" }'

*/