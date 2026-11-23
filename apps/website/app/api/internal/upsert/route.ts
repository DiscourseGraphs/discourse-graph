import { NextRequest, NextResponse } from "next/server";
import {
  isAuthApiError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";
import {
  findMissingSchemas,
  mapUpsertResults,
  parseUpsertData,
  schemaReferences,
  toOrderedEntries,
} from "@repo/database/lib/crossAppUpsert";
import internalError from "~/utils/internalErrorSsr";
import cors from "~/utils/llm/cors";
import {
  defaultOptionsHandler,
  handleRouteError,
} from "~/utils/supabase/apiUtils";
import { createBearerTokenClient } from "~/utils/supabase/server";

// The schema lookup puts every reference in its URL query, and a gateway refuses a
// long URL (the local one past about 8,200 characters). The length is measured as
// postgrest-js encodes it, through URLSearchParams with each id quoted at most.
// Real bodies reference tens of schemas, far below this bound.
const MAX_SCHEMA_LOOKUP_CHARS = 4_000;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const respond = (status: number, body: object): NextResponse =>
    cors(request, NextResponse.json(body, { status })) as NextResponse;
  try {
    const spaceParam = request.nextUrl.searchParams.get("space");
    if (
      spaceParam === null ||
      !/^\d+$/.test(spaceParam) ||
      !Number.isSafeInteger(Number(spaceParam))
    )
      return respond(400, {
        error: "The space query parameter must be a space id",
      });
    const spaceId = Number(spaceParam);
    const fail = (status: number, error: Error): NextResponse => {
      internalError({ error, type: "upsert-graph", context: { spaceId } });
      return respond(status, { error: error.message });
    };

    const token = request.headers
      .get("Authorization")
      ?.match(/^Bearer (.+)$/)?.[1];
    if (token === undefined)
      return respond(401, { error: "Missing bearer token" });
    const client = createBearerTokenClient(token);
    const { error: authError } = await client.auth.getUser(token);
    // A plugin reads 401 as "sign in again", so only the auth server's verdict
    // on the token gets it; an unreachable or rate-limiting auth server is a 502.
    if (
      (isAuthApiError(authError) &&
        authError.status < 500 &&
        authError.status !== 429) ||
      isAuthSessionMissingError(authError)
    )
      return respond(401, { error: authError.message });
    if (authError) return fail(502, authError);

    const [editorSpaceIds, space] = await Promise.all([
      client.rpc("my_space_ids", { access_level: "editor" }),
      client.from("Space").select("url").eq("id", spaceId).maybeSingle(),
    ]);
    if (editorSpaceIds.error) return fail(500, editorSpaceIds.error);
    if (space.error) return fail(500, space.error);
    if (!editorSpaceIds.data.includes(spaceId) || space.data === null)
      return respond(403, { error: "Not an editor of this space" });

    const parsed = parseUpsertData({
      body: await request.json(),
      spaceUrl: space.data.url,
    });
    if (!parsed.success)
      return respond(400, {
        error: "The body does not match the CrossApp types",
        issues: parsed.issues,
      });
    const { data } = parsed;

    const references = schemaReferences(data);
    const lookupQuery = new URLSearchParams({
      source_local_id: `in.(${references.map((id) => `"${id}"`).join(",")})`,
    }).toString();
    if (lookupQuery.length > MAX_SCHEMA_LOOKUP_CHARS)
      return respond(400, {
        error:
          "The schemas this body references but does not define are too long to look up",
      });
    const stored =
      references.length === 0
        ? { data: [], error: null }
        : await client
            .from("my_concepts")
            .select("source_local_id, literal_content")
            .eq("space_id", spaceId)
            .eq("is_schema", true)
            .in("source_local_id", references);
    if (stored.error) return fail(500, stored.error);
    const missing = findMissingSchemas({ data, storedSchemas: stored.data });
    if (missing.length > 0)
      return respond(422, {
        error: "Referenced schemas are in neither the body nor this space",
        missing,
      });

    const entries = toOrderedEntries({
      data,
      storedSchemas: stored.data,
      spaceUrl: space.data.url,
    });
    const upsert = await client.rpc("upsert_concepts", {
      v_space_id: spaceId,
      data: entries.map((e) => e.concept),
    });
    if (upsert.error) return fail(500, upsert.error);
    return respond(200, mapUpsertResults({ entries, ids: upsert.data }));
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/internal/upsert");
  }
};

export const OPTIONS = defaultOptionsHandler;
