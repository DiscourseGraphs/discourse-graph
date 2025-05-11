import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface PersonDataInput {
  name: string;
  email: string;
  orcid?: string | null;
  person_type?: string;
  account_platform_id: number;
  account_active?: boolean;
  account_write_permission?: boolean;
}

interface PersonResult {
  person: any | null;
  account: any | null;
  error: string | null;
  details?: string;
  person_created?: boolean;
  account_created?: boolean;
}

async function getOrCreatePerson(
  supabase: SupabaseClient<any, "public", any>,
  email: string,
  name: string,
  orcid: string | null | undefined,
  personType: string,
): Promise<{
  person: any | null;
  error: string | null;
  details?: string;
  created: boolean;
}> {
  let { data: existingPerson, error: fetchError } = await supabase
    .from("Person")
    .select("id, name, email, orcid, type")
    .eq("email", email)
    .maybeSingle();

  if (fetchError) {
    console.error(`Error fetching Person by email (${email}):`, fetchError);
    return {
      person: null,
      error: "Database error while fetching Person",
      details: fetchError.message,
      created: false,
    };
  }

  if (existingPerson) {
    console.log("Found existing Person:", existingPerson);
    return { person: existingPerson, error: null, created: false };
  } else {
    console.log(`Person with email "${email}" not found, creating new one...`);
    const personToInsert = {
      email: email,
      name: name,
      orcid: orcid,
      type: personType,
    };
    const { data: newPerson, error: insertError } = await supabase
      .from("Person")
      .insert(personToInsert)
      .select("id, name, email, orcid, type")
      .single();

    if (insertError) {
      console.error(
        `Error inserting new Person (email: ${email}):`,
        insertError,
      );
      return {
        person: null,
        error: "Database error while inserting Person",
        details: insertError.message,
        created: false,
      };
    }
    console.log("Created new Person:", newPerson);
    return { person: newPerson, error: null, created: true };
  }
}

async function getOrCreateAccount(
  supabase: SupabaseClient<any, "public", any>,
  personId: number,
  platformId: number,
  isActive: boolean,
  writePermission?: boolean,
): Promise<{
  account: any | null;
  error: string | null;
  details?: string;
  created: boolean;
}> {
  let { data: existingAccount, error: fetchError } = await supabase
    .from("Account")
    .select("id, person_id, platform_id, active, write_permission")
    .eq("person_id", personId)
    .eq("platform_id", platformId)
    .maybeSingle();

  if (fetchError) {
    console.error(
      `Error fetching Account (PersonID: ${personId}, PlatformID: ${platformId}):`,
      fetchError,
    );
    return {
      account: null,
      error: "Database error while fetching Account",
      details: fetchError.message,
      created: false,
    };
  }

  if (existingAccount) {
    console.log("Found existing Account:", existingAccount);
    return { account: existingAccount, error: null, created: false };
  } else {
    console.log(
      `Account for PersonID ${personId} on PlatformID ${platformId} not found, creating new one...`,
    );
    const accountToInsert: any = {
      person_id: personId,
      platform_id: platformId,
      active: isActive,
    };
    if (writePermission !== undefined) {
      accountToInsert.write_permission = writePermission;
    }

    const { data: newAccount, error: insertError } = await supabase
      .from("Account")
      .insert(accountToInsert)
      .select("id, person_id, platform_id, active, write_permission")
      .single();

    if (insertError) {
      console.error(
        `Error inserting new Account (PersonID: ${personId}, PlatformID: ${platformId}):`,
        insertError,
      );
      return {
        account: null,
        error: "Database error while inserting Account",
        details: insertError.message,
        created: false,
      };
    }
    console.log("Created new Account:", newAccount);
    return { account: newAccount, error: null, created: true };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: PersonDataInput = await request.json();
    const {
      name,
      email,
      orcid = null,
      person_type = "Person",
      account_platform_id,
      account_active = true,
      account_write_permission,
    } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      response = NextResponse.json(
        { error: "Missing or invalid name for Person" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (!email || typeof email !== "string" || email.trim() === "") {
      response = NextResponse.json(
        { error: "Missing or invalid email for Person" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (
      account_platform_id === undefined ||
      account_platform_id === null ||
      typeof account_platform_id !== "number"
    ) {
      response = NextResponse.json(
        { error: "Missing or invalid account_platform_id for Account" },
        { status: 400 },
      );
      return cors(request, response);
    }

    const personResult = await getOrCreatePerson(
      supabase,
      email.trim(),
      name.trim(),
      orcid,
      person_type,
    );

    if (personResult.error || !personResult.person) {
      console.error(
        `API Error during Person processing (Email: ${email}): ${personResult.error}`,
        personResult.details || "",
      );
      const clientError = personResult.error?.startsWith("Database error")
        ? "An internal error occurred while processing Person."
        : personResult.error;
      response = NextResponse.json(
        { error: clientError, details: personResult.details },
        { status: 500 },
      );
    } else {
      const accountResult = await getOrCreateAccount(
        supabase,
        personResult.person.id,
        account_platform_id,
        account_active,
        account_write_permission,
      );

      if (accountResult.error || !accountResult.account) {
        console.error(
          `API Error during Account processing (PersonID: ${personResult.person.id}, PlatformID: ${account_platform_id}): ${accountResult.error}`,
          accountResult.details || "",
        );
        const clientError = accountResult.error?.startsWith("Database error")
          ? "An internal error occurred while processing Account."
          : accountResult.error;
        response = NextResponse.json(
          {
            error: clientError,
            details: accountResult.details,
            person: personResult.person,
          },
          { status: 500 },
        );
      } else {
        const statusCode =
          personResult.created || accountResult.created ? 201 : 200;
        response = NextResponse.json(
          {
            person: personResult.person,
            account: accountResult.account,
            person_created: personResult.created,
            account_created: accountResult.created,
          },
          { status: statusCode },
        );
      }
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
