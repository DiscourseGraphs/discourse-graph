import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
  ItemValidator,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
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
): Promise<GetOrCreateEntityResult<AccountRecord>> => {
  const {
    agent_id,
    platform_id,
    active = true,
    write_permission = true,
    account_local_id,
  } = accountData;

  const error = validateAccount(accountData);
  if (error != null)
    return {
      entity: null,
      error,
      created: false,
      status: 400,
    };

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

  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    if (result.details.includes("agent_id_fkey")) {
      return {
        ...result,
        error: `Invalid agent_id: No Person record found for ID ${agent_id}.`,
      };
    } else if (result.details.includes("Account_platform_id_fkey")) {
      return {
        ...result,
        error: `Invalid platform_id: No Platform record found for ID ${platform_id}.`,
      };
    }
  }
  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: AccountDataInput = await request.json();

    if (body.agent_id === undefined || body.agent_id === null) {
      return createApiResponse(request, {
        error: "Missing or invalid agent_id.",
        status: 400,
      });
    }
    if (body.platform_id === undefined || body.platform_id === null) {
      return createApiResponse(request, {
        error: "Missing or invalid platform_id.",
        status: 400,
      });
    }

    const result = await getOrCreateAccount(supabasePromise, body);

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/account");
  }
};

export const OPTIONS = defaultOptionsHandler;
