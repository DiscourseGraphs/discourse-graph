import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

type AccountDataInput = {
  person_id: number;
  platform_id: number;
  active?: boolean;
  write_permission?: boolean;
};

// Represents the structure of an account record fetched from or inserted into the DB
type AccountRecord = {
  id: number;
  person_id: number;
  platform_id: number;
  active: boolean;
  write_permission: boolean;
};

// Represents the payload for inserting a new account
type AccountInsertPayload = {
  person_id: number;
  platform_id: number;
  active: boolean;
  write_permission: boolean;
};

// Represents the return type of the getOrCreateAccountEntry function
type GetOrCreateAccountEntryReturn = {
  account: AccountRecord | null;
  error: string | null;
  details?: string;
  created: boolean;
};

async function getOrCreateAccountEntry(
  supabase: SupabaseClient<any, "public", any>,
  accountData: AccountDataInput,
): Promise<GetOrCreateAccountEntryReturn> {
  const {
    person_id,
    platform_id,
    active = true,
    write_permission = true,
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

  let { data: existingAccount, error: fetchError } = await supabase
    .from("Account")
    .select("id, person_id, platform_id, active, write_permission")
    .eq("person_id", person_id)
    .eq("platform_id", platform_id)
    .maybeSingle<AccountRecord>();

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
    return { account: existingAccount, error: null, created: false };
  }

  const accountToInsertData: AccountInsertPayload = {
    person_id,
    platform_id,
    active,
    write_permission,
  };

  const { data: newAccount, error: insertError } = await supabase
    .from("Account")
    .insert(accountToInsertData)
    .select("id, person_id, platform_id, active, write_permission")
    .single<AccountRecord>();

  if (insertError) {
    console.error(
      `Error inserting new Account (PersonID: ${person_id}, PlatformID: ${platform_id}):`,
      insertError,
    );
    if (insertError.code === "23503") {
      if (insertError.message.includes("Account_person_id_fkey")) {
        return {
          account: null,
          error: `Invalid person_id: No Person record found for ID ${person_id}.`,
          details: insertError.message,
          created: false,
        };
      } else if (insertError.message.includes("Account_platform_id_fkey")) {
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

  return { account: newAccount, error: null, created: true };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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
  } catch (e: unknown) {
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

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}
