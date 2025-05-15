import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors"; // Adjust path if needed

interface AccountDataInput {
  person_id: number;
  platform_id: number; // This is DiscoursePlatform.id
  active?: boolean;
  write_permission?: boolean; // From visual schema
}

// interface AccountResult { // Or just return the account object or a simple wrapper
//   account: any | null;
//   error: string | null;
//   details?: string;
// }

async function getOrCreateAccountEntry( // "Get or Create" because an account for a person on a platform is unique
  supabase: SupabaseClient<any, "public", any>,
  accountData: AccountDataInput,
): Promise<{
  account: any | null;
  error: string | null;
  details?: string;
  created: boolean;
}> {
  const {
    person_id,
    platform_id,
    active = true,
    write_permission = true, // MODIFIED: Default to true for testing
  } = accountData;

  if (
    person_id === undefined ||
    person_id === null ||
    platform_id === undefined ||
    platform_id === null
  ) {
    return {
      account: null,
      error: "Missing required fields: person_id or platform_id",
      details: "Both person_id and platform_id are required.",
      created: false,
    };
  }

  // Check if account already exists for this person on this platform
  let { data: existingAccount, error: fetchError } = await supabase
    .from("Account")
    .select("id, person_id, platform_id, active, write_permission")
    .eq("person_id", person_id)
    .eq("platform_id", platform_id)
    .maybeSingle();

  if (fetchError) {
    console.error(
      `Error fetching Account (PersonID: ${person_id}, PlatformID: ${platform_id}):`,
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
    // Optionally, update active or write_permission status if needed and provided?
    // For now, just return existing.
    return { account: existingAccount, error: null, created: false };
  }

  // Create new account
  const accountToInsert: any = {
    person_id,
    platform_id,
    active,
  };
  if (write_permission !== undefined) {
    accountToInsert.write_permission = write_permission;
  }

  const { data: newAccount, error: insertError } = await supabase
    .from("Account")
    .insert(accountToInsert)
    .select("id, person_id, platform_id, active, write_permission")
    .single();

  if (insertError) {
    console.error(
      `Error inserting new Account (PersonID: ${person_id}, PlatformID: ${platform_id}):`,
      insertError,
    );
    // Check for foreign key violations
    if (insertError.code === "23503") {
      // Foreign key violation
      if (insertError.message.includes("Account_person_id_fkey")) {
        return {
          account: null,
          error: `Invalid person_id: No Person record found for ID ${person_id}.`,
          details: insertError.message,
          created: false,
        };
      } else if (insertError.message.includes("Account_platform_id_fkey")) {
        // Adjust FK name if different
        return {
          account: null,
          error: `Invalid platform_id: No DiscoursePlatform record found for ID ${platform_id}.`,
          details: insertError.message,
          created: false,
        };
      }
    }
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: AccountDataInput = await request.json();

    if (
      body.person_id === undefined ||
      body.person_id === null ||
      typeof body.person_id !== "number"
    ) {
      response = NextResponse.json(
        { error: "Missing or invalid person_id" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (
      body.platform_id === undefined ||
      body.platform_id === null ||
      typeof body.platform_id !== "number"
    ) {
      response = NextResponse.json(
        { error: "Missing or invalid platform_id" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    // active and write_permission are optional in input

    const result = await getOrCreateAccountEntry(supabase, body);

    if (result.error || !result.account) {
      console.error(
        `API Error for Account creation (PersonID: ${body.person_id}, PlatformID: ${body.platform_id}): ${result.error}`,
        result.details || "",
      );
      const clientError = result.error?.startsWith("Database error")
        ? "An internal error occurred."
        : result.error;
      const statusCode = result.error?.includes("Invalid") ? 400 : 500;
      response = NextResponse.json(
        { error: clientError, details: result.details },
        { status: statusCode },
      );
    } else {
      response = NextResponse.json(result.account, {
        status: result.created ? 201 : 200,
      });
    }
  } catch (e: any) {
    console.error("API route error in /api/supabase/insert/Account:", e);
    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      response = NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    } else {
      response = NextResponse.json(
        { error: "An unexpected error occurred" },
        { status: 500 },
      );
    }
  }
  return cors(request, response) as NextResponse;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}
