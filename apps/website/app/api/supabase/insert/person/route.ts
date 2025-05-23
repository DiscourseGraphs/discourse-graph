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

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: PersonDataInput = await request.json();
    const {
      name,
      email,
      orcid = null, // Default from input
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
