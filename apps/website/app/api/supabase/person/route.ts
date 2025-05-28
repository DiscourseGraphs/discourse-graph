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
): Promise<PostgrestSingleResponse<PersonRecord>> => {
  const supabase = await supabasePromise;
  // TODO: Rewrite in a transaction with the ORM later.
  const agentResponse = await getOrCreateEntity<"Agent">({
    supabase,
    tableName: "Agent",
    insertData: { type: "Person" },
  });
  if (agentResponse.error || agentResponse.data === null)
    return agentResponse as any as PostgrestSingleResponse<PersonRecord>;
  const result = await getOrCreateEntity<"Person">({
    supabase,
    tableName: "Person",
    insertData: {
      id: agentResponse.data.id,
      email: email.trim(),
      name: name.trim(),
      orcid: orcid || null,
    },
    uniqueOn: ["email"],
  });
  if (result.error) {
    await supabase.from("Agent").delete().eq("id", agentResponse.data.id);
    // not much to do if an error here
  }
  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: PersonDataInput = await request.json();
    const { name, email, orcid = null } = body;
    const error = personValidator(body);
    if (error !== null)
      return createApiResponse(request, asPostgrestFailure(error, "invalid"));

    const personResult = await getOrCreatePersonInternal(
      supabasePromise,
      email,
      name,
      orcid,
    );

    return createApiResponse(request, personResult);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/person");
  }
};

export const OPTIONS = defaultOptionsHandler;
