import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler, // Assuming OPTIONS might be added later
} from "~/utils/supabase/apiUtils";
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

type PersonDataInput = TablesInsert<"Person">;
type PersonRecord = Tables<"Person">;
type AccountRecord = Tables<"Account">;

// Kept for the final API response structure
// type PersonWithAccountResult = {
//   person: PersonRecord | null;
//   account: AccountRecord | null;
//   person_created?: boolean;
//   account_created?: boolean;
// };

const getOrCreatePersonInternal = async (
  supabasePromise: ReturnType<typeof createClient>,
  email: string,
  name: string,
  orcid: string | null | undefined,
): Promise<GetOrCreateEntityResult<PersonRecord>> => {
  const supabase = await supabasePromise;
  const agent_response = await getOrCreateEntity<"Agent">(
    supabase,
    "Agent",
    "id, type",
    { type: "Person" },
    { type: "Person" },
    "Agent",
  );
  if (agent_response.error || agent_response.entity === null)
    return agent_response as any as GetOrCreateEntityResult<PersonRecord>;
  return getOrCreateEntity<"Person">(
    supabase,
    "Person",
    "id, name, email, orcid, type",
    { email: email.trim() },
    {
      id: agent_response.entity.id,
      email: email.trim(),
      name: name.trim(),
      orcid: orcid || null,
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
  const result = await getOrCreateEntity<"Account">(
    supabase,
    "Account",
    "id, person_id, platform_id, active, write_permission",
    { person_id: personId, platform_id: platformId },
    {
      person_id: personId,
      platform_id: platformId,
      active: isActive,
      write_permission: writePermission === undefined ? true : writePermission, // Default to true if undefined
    },
    "Account",
  );

  // Custom handling for specific foreign key errors
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

  // MAP: Punting the joint creation of person and account. Create the account after the person.
  try {
    const body: PersonDataInput = await request.json();
    const {
      name,
      email,
      orcid = null, // Default from input
      // account_platform_id,
      // account_active = true, // Default from input
      // account_write_permission, // No default here, handled in getOrCreateAccountInternal
    } = body;

    // Initial input validation
    if (!name || typeof name !== "string" || name.trim() === "") {
      return createApiResponse(request, {
        error: "Missing or invalid name for Person.",
        status: 400,
      });
    }
    if (!email || typeof email !== "string" || email.trim() === "") {
      return createApiResponse(request, {
        error: "Missing or invalid email for Person.",
        status: 400,
      });
    }
    // if (
    //   account_platform_id === undefined ||
    //   account_platform_id === null ||
    //   typeof account_platform_id !== "number"
    // ) {
    //   return createApiResponse(request, {
    //     error: "Missing or invalid account_platform_id for Account.",
    //     status: 400,
    //   });
    // }

    // Get or Create Person
    const personResult = await getOrCreatePersonInternal(
      supabasePromise, // Pass the promise
      email,
      name,
      orcid,
    );

    if (personResult.error || !personResult.entity) {
      return createApiResponse(request, {
        error: personResult.error || "Failed to process Person.",
        details: personResult.details,
        status: personResult.status || 500,
      });
    }

    // // Get or Create Account
    // const accountResult = await getOrCreateAccountInternal(
    //   supabasePromise, // Pass the promise again, it will resolve the same client or a new one if needed by createClient impl.
    //   personResult.entity.id,
    //   account_platform_id,
    //   account_active,
    //   account_write_permission,
    // );

    // if (accountResult.error || !accountResult.entity) {
    //   // If account creation fails, return error but include successfully processed person
    //   return createApiResponse(request, {
    //     error: accountResult.error || "Failed to process Account.",
    //     details: accountResult.details,
    //     status: accountResult.status || 500,
    //     // Optionally include person data if account failed
    //     // data: { person: personResult.entity, person_created: personResult.created }
    //   });
    // }

    // const responsePayload: PersonWithAccountResult = {
    //   person: personResult.entity,
    //   account: accountResult.entity,
    //   person_created: personResult.created,
    //   account_created: accountResult.created,
    // };

    // const overallStatus =
    //   personResult.created || accountResult.created ? 201 : 200;
    const overallStatus = personResult.created ? 201 : 200;

    return createApiResponse(request, {
      data: personResult,
      status: overallStatus,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/person");
  }
};

// If you need an OPTIONS handler for this route:
// export const OPTIONS = defaultOptionsHandler;
