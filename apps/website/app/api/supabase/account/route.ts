import { NextResponse, NextRequest } from "next/server";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import { createClient } from "~/utils/supabase/server";
import { getOrCreateEntity, ItemValidator } from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

type AccountDataInput = TablesInsert<"Account">;
type AccountRecord = Tables<"Account">;

const validateAccount: ItemValidator<AccountDataInput> = (account) => {
  if (!account || typeof account !== "object")
    return "Invalid request body: expected a JSON object.";
  if (!account.agent_id) return "Missing required agent_id";
  if (!account.platform_id) return "Missing required platform_id";
  return null;
};

const getOrCreateAccount = async (
  supabasePromise: ReturnType<typeof createClient>,
  accountData: AccountDataInput,
): Promise<PostgrestSingleResponse<AccountRecord>> => {
  const {
    agent_id,
    platform_id,
    active = true,
    write_permission = true,
    account_local_id,
  } = accountData;

  const error = validateAccount(accountData);
  if (error !== null) return asPostgrestFailure(error, "invalid");

  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<"Account">({
    supabase,
    tableName: "Account",
    insertData: {
      agent_id,
      platform_id,
      active,
      write_permission,
      account_local_id,
    },
    uniqueOn: ["agent_id", "platform_id"],
  });
  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: AccountDataInput = await request.json();
    const result = await getOrCreateAccount(supabasePromise, body);

    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/account");
  }
};

export const OPTIONS = defaultOptionsHandler;
