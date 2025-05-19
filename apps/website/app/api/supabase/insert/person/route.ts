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

const PersonDataInputSchema = z.object({
  name: z.string().trim().min(1, { message: "Name cannot be empty." }),
  email: z.string().trim().email({ message: "Invalid email format." }),
  orcid: z.string().nullable().optional(),
  person_type: z.string().optional().default("Person"),
  account_platform_id: z
    .number()
    .int()
    .positive({ message: "account_platform_id must be a positive integer." }),
  account_active: z.boolean().optional().default(true),
  account_write_permission: z.boolean().optional(),
});

type PersonDataInput = z.infer<typeof PersonDataInputSchema>;

type PersonRecord = {
  id: number;
  name: string;
  email: string;
  orcid: string | null;
  type: string;
};

type AccountRecord = {
  id: number;
  person_id: number;
  platform_id: number;
  active: boolean;
  write_permission: boolean;
};

type PersonWithAccountResult = {
  person: PersonRecord | null;
  account: AccountRecord | null;
  person_created?: boolean;
  account_created?: boolean;
};

const getOrCreatePersonInternal = async (
  supabasePromise: ReturnType<typeof createClient>,
  email: string,
  name: string,
  orcid: string | null | undefined,
  personType: string,
): Promise<GetOrCreateEntityResult<PersonRecord>> => {
  const supabase = await supabasePromise;
  return getOrCreateEntity<PersonRecord>(
    supabase,
    "Person",
    "id, name, email, orcid, type",
    { email: email },
    {
      email: email,
      name: name,
      orcid: orcid || null,
      type: personType,
    },
    "Person",
  );
};

const getOrCreateAccountInternal = async (
  supabasePromise: ReturnType<typeof createClient>,
  personId: number,
  platformId: number,
  isActive: boolean,
  writePermission?: boolean,
): Promise<GetOrCreateEntityResult<AccountRecord>> => {
  const supabase = await supabasePromise;
  const result = await getOrCreateEntity<AccountRecord>(
    supabase,
    "Account",
    "id, person_id, platform_id, active, write_permission",
    { person_id: personId, platform_id: platformId },
    {
      person_id: personId,
      platform_id: platformId,
      active: isActive,
      write_permission: writePermission === undefined ? true : writePermission,
    },
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
        error: `Invalid person_id for Account: No Person record found for ID ${personId}.`,
      };
    }
    if (result.details.includes("Account_platform_id_fkey")) {
      return {
        ...result,
        error: `Invalid platform_id for Account: No DiscoursePlatform record found for ID ${platformId}.`,
      };
    }
  }
  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();

    const validationResult = PersonDataInputSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return createApiResponse(request, {
        error: "Validation Error",
        details: errorMessages,
        status: 400,
      });
    }

    const {
      name,
      email,
      orcid,
      person_type,
      account_platform_id,
      account_active,
      account_write_permission,
    } = validationResult.data;

    const personResult = await getOrCreatePersonInternal(
      supabasePromise,
      email,
      name,
      orcid,
      person_type,
    );

    if (personResult.error || !personResult.entity) {
      return createApiResponse(request, {
        error: personResult.error || "Failed to process Person.",
        details: personResult.details,
        status: personResult.status || 500,
      });
    }

    const accountResult = await getOrCreateAccountInternal(
      supabasePromise,
      personResult.entity.id,
      account_platform_id,
      account_active,
      account_write_permission,
    );

    if (accountResult.error || !accountResult.entity) {
      return createApiResponse(request, {
        error: accountResult.error || "Failed to process Account.",
        details: accountResult.details,
        status: accountResult.status || 500,
      });
    }

    const responsePayload: PersonWithAccountResult = {
      person: personResult.entity,
      account: accountResult.entity,
      person_created: personResult.created,
      account_created: accountResult.created,
    };

    const overallStatus =
      personResult.created || accountResult.created ? 201 : 200;

    return createApiResponse(request, {
      data: responsePayload,
      status: overallStatus,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/person");
  }
};

export const OPTIONS = defaultOptionsHandler;
