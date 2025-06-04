import { NextResponse, NextRequest } from "next/server";

import { createClient } from "~/utils/supabase/server";
import { getOrCreateEntity, ItemValidator } from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import { TablesInsert } from "@repo/database/types.gen.ts";

type PlatformAccountDataInput = TablesInsert<"PlatformAccount">;

const accountValidator: ItemValidator<PlatformAccountDataInput> = (account: any) => {
  if (!account || typeof account !== "object")
    return "Invalid request body: expected a JSON object.";
  const { name, platform, account_local_id, write_permission, active, agent_type, metadata, dg_account } = account;

  if (!name || typeof name !== "string" || name.trim() === "")
    return "Missing or invalid name";
  // This is not dry, to be rewritten with Drizzle/Zed.
  if (!(platform in ["Roam", "Obsidian"]))
    return "Missing or invalid platform";
  if (agent_type !== undefined && !(agent_type in ["person", "organization", "automated_agent"]))
    return "Invalid agent_type";
  if (write_permission !== undefined && typeof write_permission != 'boolean')
    return "write_permission must be boolean";
  if (active !== undefined && typeof active != 'boolean')
    return "active must be boolean";
  if (metadata !== undefined) {
    if (typeof metadata != 'string')
      return "metadata should be a JSON string";
    else try {
      JSON.parse(metadata)
    } catch (error) {
      return "metadata should be a JSON string";
    }
  }
  if (!account_local_id || typeof account_local_id != "string" || account_local_id.trim() === "")
    return "Missing or invalid account_local_id";
  if (dg_account != undefined) {
    if (typeof account_local_id != "string")
      return "dg_account should be a UUID string";
    // TODO: Check it is a UUID
  }
  const keys = [ 'name', 'platform', 'account_local_id', 'write_permission', 'active', 'agent_type', 'metadata', 'dg_account' ];
  if (!Object.keys(account).every((key)=>keys.includes(key)))
    return "Invalid account object: extra keys";
  return null;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();
    const error = accountValidator(body);
    if (error !== null)
      return createApiResponse(request, asPostgrestFailure(error, "invalid"));

    const supabase = await supabasePromise;
    const result = await getOrCreateEntity<"PlatformAccount">({
      supabase,
      tableName: "PlatformAccount",
      insertData: body as PlatformAccountDataInput,
      uniqueOn: ["account_local_id", "platform"],
    });

    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/platform_account");
  }
};

export const OPTIONS = defaultOptionsHandler;
