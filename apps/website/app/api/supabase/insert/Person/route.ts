import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

// MODIFIED: Input type no longer expects 'id' from the client for creation
type PersonDataInput = {
  name: string;
  email: string;
  orcid?: string | null;
};

// MODIFIED: Return type includes 'created' flag and consistent Person structure
type PersonUpsertResult = {
  person: {
    id: number;
    name: string;
    email: string;
    orcid?: string | null;
  } | null;
  error: string | null;
  details?: string | null;
  created?: boolean; // To indicate if a new person was created
};

// MODIFIED: Function renamed and logic completely overhauled for "get or create"
const getOrCreatePersonEntry = async (
  supabase: SupabaseClient<any, "public", any>,
  personData: PersonDataInput,
): Promise<PersonUpsertResult> => {
  const { name, email, orcid = null } = personData;

  if (!name || !email) {
    return {
      person: null,
      error: "Validation Error: Missing required fields: name or email",
      details: "Both 'name' and 'email' are required.",
      created: false,
    };
  }

  // 1. Check if a Person with this email already exists
  const { data: existingPerson, error: fetchError } = await supabase
    .from("Person")
    .select("id, name, email, orcid")
    .eq("email", email)
    .maybeSingle(); // Use maybeSingle as email should be unique

  if (fetchError) {
    console.error(
      `Supabase error fetching Person by email (${email}):`,
      fetchError,
    );
    return {
      person: null,
      error: "Database error while fetching Person by email.",
      details: fetchError.message ?? null,
      created: false,
    };
  }

  if (existingPerson) {
    console.log("Found existing Person by email:", existingPerson);
    // Optionally, you could update the name or orcid if they differ,
    // but for a strict "get or create", just return the existing one.
    return { person: existingPerson, error: null, created: false };
  }

  // 2. Person not found, so create a new Agent and then a new Person
  console.log(
    `Person with email ${email} not found. Creating new Agent and Person.`,
  );

  // 2a. Create a new Agent
  const { data: newAgent, error: agentInsertError } = await supabase
    .from("Agent") // Assuming your table is named "Agent" (singular, capitalized)
    .insert({ type: "Person" }) // Set the type for the new Agent
    .select("id")
    .single();

  if (agentInsertError || !newAgent?.id) {
    console.error(
      "Supabase error creating new Agent for Person:",
      agentInsertError,
    );
    return {
      person: null,
      error:
        "Database error: Failed to create underlying Agent for new Person.",
      details: agentInsertError?.message ?? "Agent creation returned no ID.",
      created: false,
    };
  }

  const newAgentId = newAgent.id;

  // 2b. Create the new Person linked to the new Agent
  const personToInsert = {
    id: newAgentId, // Link Person.id to the new Agent.id
    name,
    email,
    orcid,
  };

  const { data: newPerson, error: personInsertError } = await supabase
    .from("Person")
    .insert(personToInsert)
    .select("id, name, email, orcid")
    .single();

  if (personInsertError) {
    console.error(
      `Supabase error inserting new Person (Agent ID: ${newAgentId}, email: ${email}):`,
      personInsertError,
    );
    // If Agent creation succeeded but Person insert failed, this is a problem.
    // For now, just return the error. Consider cleanup logic for orphaned Agent if necessary.
    return {
      person: null,
      error: "Database error while inserting new Person record.",
      details: personInsertError.message ?? null,
      created: false, // Person creation failed
    };
  }

  console.log("Created new Person:", newPerson);
  return { person: newPerson, error: null, created: true };
};

export const POST = async (request: NextRequest) => {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: PersonDataInput = await request.json();

    // MODIFIED: Validation for name and email (id is no longer expected from client)
    if (
      !body.name ||
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      response = NextResponse.json(
        { error: "Validation Error: Missing or invalid name for Person" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (
      !body.email ||
      typeof body.email !== "string" ||
      !body.email.includes("@") ||
      body.email.trim() === ""
    ) {
      response = NextResponse.json(
        { error: "Validation Error: Missing or invalid email for Person" },
        { status: 400 },
      );
      return cors(request, response);
    }
    // ORCID is optional

    const result = await getOrCreatePersonEntry(supabase, body);

    if (result.error || !result.person) {
      console.error(
        `API Error during Person get/create (email: ${body.email}): ${result.error}. Details: ${result.details || "N/A"}`,
      );

      let statusCode = 500; // Default
      if (result.error?.toLowerCase().includes("validation error")) {
        statusCode = 400;
      } else if (result.error === "23505") {
        // Unique constraint violation (e.g., if email unique constraint exists and somehow this logic fails)
        statusCode = 409; // Conflict
      }
      // Add more specific status codes based on result.supabase_code if needed

      response = NextResponse.json(
        {
          error: result.error,
          details: result.details,
        },
        { status: statusCode },
      );
    } else {
      // MODIFIED: Status 200 if found, 201 if created
      response = NextResponse.json(result.person, {
        status: result.created ? 201 : 200,
      });
    }
  } catch (e: any) {
    console.error("API route error in /api/supabase/insert/Person:", e);
    let errorPayload: { error: string; details?: string } = {
      error: "An unexpected server error occurred",
    };
    let status = 500;

    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      errorPayload = { error: "Invalid JSON in request body" };
      status = 400;
    } else if (e.message) {
      errorPayload.details = e.message;
    }
    response = NextResponse.json(errorPayload, { status });
  }
  return cors(request, response);
};

// OPTIONS handler remains the same
export const OPTIONS = async (request: NextRequest) => {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response);
};
