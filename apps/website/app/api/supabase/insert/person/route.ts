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

type PersonDataInput = TablesInsert<"Person">;
type PersonRecord = Tables<"Person">;

const personValidator: ItemValidator<PersonDataInput> = (person) => {
  if (!person || typeof person !== "object")
    return "Invalid request body: expected a JSON object.";
  const { name, email } = person;

  if (!name || typeof name !== "string" || name.trim() === "")
    return "Missing or invalid name for Person.";
  if (!email || typeof email !== "string" || email.trim() === "")
    return "Missing or invalid email for Person.";
  return null;
};

const getOrCreatePersonInternal = async (
  supabasePromise: ReturnType<typeof createClient>,
  email: string,
  name: string,
  orcid: string | null | undefined,
): Promise<GetOrCreateEntityResult<PersonRecord>> => {
  const supabase = await supabasePromise;
  const agent_response = await getOrCreateEntity<"Agent">({
    supabase,
    tableName: "Agent",
    insertData: { type: "Person" },
  });
  if (agent_response.error || agent_response.entity === null)
    return agent_response as any as GetOrCreateEntityResult<PersonRecord>;
  return getOrCreateEntity<"Person">({
    supabase,
    tableName: "Person",
    insertData: {
      id: agent_response.entity.id,
      email: email.trim(),
      name: name.trim(),
      orcid: orcid || null,
    },
    uniqueOn: ["email"],
  });
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: PersonDataInput = await request.json();
    const { name, email, orcid = null } = body;
    const error = personValidator(body);
    if (error !== null) {
      return createApiResponse(request, {
        error,
        status: 400,
      });
    }

    const personResult = await getOrCreatePersonInternal(
      supabasePromise,
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

export const OPTIONS = defaultOptionsHandler;
