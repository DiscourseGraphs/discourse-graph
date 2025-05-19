import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";

type AccountDataInput = {
  person_id: number;
  platform_id: number;
  active?: boolean;
  write_permission?: boolean;
};

type AccountRecord = {
  id: number;
  person_id: number;
  platform_id: number;
  active: boolean;
  write_permission: boolean;
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

  if (
    person_id === undefined ||
    person_id === null ||
    platform_id === undefined ||
    platform_id === null
  ) {
    return {
      entity: null,
      error: "Missing required fields: person_id or platform_id.",
      details: "Both person_id and platform_id are required.",
      created: false,
      status: 400,
    };
  }

  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<AccountRecord>(
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
        error: `Invalid platform_id: No DiscoursePlatform record found for ID ${platform_id}.`,
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
