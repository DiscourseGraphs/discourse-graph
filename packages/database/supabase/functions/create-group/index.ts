// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "@supabase/functions-js/edge-runtime";
import { createClient } from "@supabase/supabase-js";
import type { DGSupabaseClient } from "@repo/database/lib/client";

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

  // @ts-ignore Deno is not visible to the IDE
  const url = Deno.env.get("SUPABASE_URL");
  // @ts-ignore Deno is not visible to the IDE
  const service_key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  // @ts-ignore Deno is not visible to the IDE
  const anon_key = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !anon_key || !service_key) {
    return new Response("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY", {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(url, anon_key)
  const authHeader = req.headers.get('Authorization')!
  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabase.auth.getClaims(token)

  const userEmail = data?.claims?.email
  if (!userEmail || error || data?.claims?.is_anonymous === true) {
    return Response.json(
      { msg: 'Invalid JWT' },
      {
        status: 401,
      }
    )
  }
  const groupName = crypto.randomUUID();
  const password = crypto.randomUUID();
  const supabaseAdmin: DGSupabaseClient = createClient(url, service_key);
  const userResponse = await supabaseAdmin.auth.admin.createUser({
    email: `${groupName}@groups.discoursegraphs.com`,
    password,
    email_confirm: false, // eslint-disable-line @typescript-eslint/naming-convention
  });
  if (userResponse.error)
    throw userResponse.error;
  if (!userResponse.data.user)
    throw new Error("Did not create user");
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const group_id = userResponse.data.user.id;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const membershipResponse = await supabaseAdmin.from("group_membership").insert({group_id, member_id:data.claims.sub, admin:true});
  console.log(membershipResponse)

  const res = new Response(group_id);

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
