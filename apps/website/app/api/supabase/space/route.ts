import { NextResponse, NextRequest } from "next/server";
import {
  type PostgrestSingleResponse,
  PostgrestError,
  type User,
} from "@supabase/supabase-js";
import { createClient } from "~/utils/supabase/server";
import { getOrCreateEntity, ItemValidator } from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import { Tables, TablesInsert } from "@repo/database/types.gen.ts";
import { spaceAnonUserEmail } from "@repo/ui/lib/utils";

type SpaceDataInput = TablesInsert<"Space">;
type SpaceRecord = Tables<"Space">;

type SpaceCreationInput = SpaceDataInput & { password: string };

const spaceValidator: ItemValidator<SpaceCreationInput> = (space) => {
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

const processAndGetOrCreateSpace = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: SpaceCreationInput,
): Promise<PostgrestSingleResponse<SpaceRecord>> => {
  const { name, url, platform, password } = data;
  const error = spaceValidator(data);
  if (error !== null) return asPostgrestFailure(error, "invalid space");

  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<"Space">({
    supabase,
    tableName: "Space",
    insertData: {
      name: name.trim(),
      url: url.trim().replace(/\/$/, ""),
      platform,
    },
    uniqueOn: ["url"],
  });
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
    if (error && error.message !== "Invalid login credentials") {
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
    anonymousUser = resultCreateAnonymousUser.data.user;
  }
  // NOTE: The next few steps could be done as the new user, except the SpaceAccess
  const anonPlatformUserResult = await getOrCreateEntity<"PlatformAccount">({
    supabase,
    tableName: "PlatformAccount",
    insertData: {
      platform,
      account_local_id: email,
      name: `Anonymous of space ${space_id}`,
      agent_type: "anonymous",
      dg_account: anonymousUser.id,
    },
    uniqueOn: ["account_local_id", "platform"],
  });
  if (anonPlatformUserResult.error) return anonPlatformUserResult;

  const resultAnonUserSpaceAccess = await getOrCreateEntity<"SpaceAccess">({
    supabase,
    tableName: "SpaceAccess",
    insertData: {
      space_id,
      account_id: anonPlatformUserResult.data.id,
      editor: true,
    },
    uniqueOn: ["space_id", "account_id"],
  });
  if (resultAnonUserSpaceAccess.error) return resultAnonUserSpaceAccess; // space created but not connected, try again
  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: SpaceCreationInput = await request.json();
    const result = await processAndGetOrCreateSpace(supabasePromise, body);
    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/space");
  }
};

export const OPTIONS = defaultOptionsHandler;
