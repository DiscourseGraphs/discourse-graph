import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";

const AccountDataInputSchema = z.object({
  person_id: z
    .number()
    .int()
    .positive({ message: "person_id must be a positive integer." }),
  platform_id: z
    .number()
    .int()
    .positive({ message: "platform_id must be a positive integer." }),
  active: z.boolean().optional().default(true),
  write_permission: z.boolean().optional().default(true),
});

type AccountDataInput = z.infer<typeof AccountDataInputSchema>;

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
  const { person_id, platform_id, active, write_permission } = accountData;

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
    const body = await request.json();

    const validationResult = AccountDataInputSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join(".")} - ${e.message}`)
        .join("; ");
      return createApiResponse(request, {
        error: "Validation Error",
        details: errorMessages,
        status: 400,
      });
    }

    const validatedAccountData = validationResult.data;

    const result = await getOrCreateAccount(
      supabasePromise,
      validatedAccountData,
    );

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
