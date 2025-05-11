import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface PersonDataInput {
  id: number;
  name: string;
  email: string;
  orcid?: string | null;
}

async function createPersonEntry(
  supabase: SupabaseClient<any, "public", any>,
  personData: PersonDataInput,
): Promise<{ person: any | null; error: string | null; details?: string }> {
  const { id, name, email, orcid = null } = personData;

  if (id === undefined || id === null || !name || !email) {
    return {
      person: null,
      error: "Missing required fields for Person: id, name, or email",
      details: "Ensure 'id' (from Agent), 'name', and 'email' are provided.",
    };
  }

  const personToInsert = {
    id,
    email,
    name,
    orcid,
  };

  const { data: existingPersonById, error: fetchByIdError } = await supabase
    .from("Person")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (fetchByIdError) {
    console.error(
      `Error checking for existing Person by ID (${id}):`,
      fetchByIdError,
    );
    return {
      person: null,
      error: "Database error while checking for existing Person by ID",
      details: fetchByIdError.message,
    };
  }
  if (existingPersonById) {
    console.warn(
      `Person with ID ${id} already exists. Returning existing (or error if data mismatch).`,
    );
  }

  const { data: existingPersonByEmail, error: fetchByEmailError } =
    await supabase
      .from("Person")
      .select("id, email")
      .eq("email", email)
      .not("id", "eq", id)
      .maybeSingle();

  if (fetchByEmailError) {
    console.error(
      `Error checking for existing Person by email (${email}):`,
      fetchByEmailError,
    );
  }
  if (existingPersonByEmail) {
    console.warn(
      `Another Person record (ID: ${existingPersonByEmail.id}) already exists with email ${email}. Potential duplicate email.`,
    );
  }

  const { data: newPerson, error: insertPersonError } = await supabase
    .from("Person")
    .insert(personToInsert)
    .select("id, name, email, orcid")
    .single();

  if (insertPersonError) {
    console.error(
      `Error inserting new Person (ID: ${id}, email: ${email}):`,
      insertPersonError,
    );
    if (
      insertPersonError.code === "23505" &&
      insertPersonError.message.includes("Person_pkey")
    ) {
      return {
        person: null,
        error: `Person with ID ${id} already exists. Primary key violation.`,
        details: insertPersonError.message,
      };
    }
    return {
      person: null,
      error: "Database error while inserting Person",
      details: insertPersonError.message,
    };
  }

  console.log("Created new Person:", newPerson);
  return { person: newPerson, error: null };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: PersonDataInput = await request.json();

    if (
      body.id === undefined ||
      body.id === null ||
      typeof body.id !== "number"
    ) {
      response = NextResponse.json(
        { error: "Missing or invalid id (Agent ID) for Person" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (
      !body.name ||
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      response = NextResponse.json(
        { error: "Missing or invalid name for Person" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (
      !body.email ||
      typeof body.email !== "string" ||
      body.email.trim() === ""
    ) {
      response = NextResponse.json(
        { error: "Missing or invalid email for Person" },
        { status: 400 },
      );
      return cors(request, response);
    }

    const result = await createPersonEntry(supabase, body);

    if (result.error || !result.person) {
      console.error(
        `API Error during Person creation (ID: ${body.id}): ${result.error}`,
        result.details || "",
      );
      const clientError = result.error?.startsWith("Database error")
        ? "An internal error occurred while processing Person."
        : result.error;
      const statusCode = result.error?.includes("already exists") ? 409 : 500;
      response = NextResponse.json(
        { error: clientError, details: result.details },
        { status: statusCode },
      );
    } else {
      response = NextResponse.json(result.person, { status: 201 });
    }
  } catch (e: any) {
    console.error("API route error in /api/supabase/insert/Person:", e);
    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      response = NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    } else {
      response = NextResponse.json(
        { error: "An unexpected error occurred processing your request" },
        { status: 500 },
      );
    }
  }
  return cors(request, response);
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response);
}
