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
  if (!account.person_id) return "Missing required person_id";
  if (!account.platform_id) return "Missing required platform_id";
  return null;
};

const getOrCreateAccount = async (
  supabasePromise: ReturnType<typeof createClient>,
  accountData: AccountDataInput,
): Promise<GetOrCreateEntityResult<AccountRecord>> => {
  const {
    person_id,
    platform_id,
    active = true,
    write_permission = true,
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

  const result = await getOrCreateEntity<"Account">(
    supabase,
    "Account",
    "id, person_id, platform_id, active, write_permission",
    { person_id: person_id, platform_id: platform_id },
    { person_id, platform_id, active, write_permission },
    "Account",
  );

  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    if (result.details.includes("Account_person_id_fkey")) {
      return {
        ...result,
        error: `Invalid person_id: No Person record found for ID ${person_id}.`,
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

    if (body.person_id === undefined || body.person_id === null) {
      return createApiResponse(request, {
        error: "Missing or invalid person_id.",
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
