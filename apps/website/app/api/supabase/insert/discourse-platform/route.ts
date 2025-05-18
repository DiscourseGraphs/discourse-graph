import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

type DiscoursePlatformRecord = {
  id: number;
  name: string;
  url: string;
  // Add other fields from your DiscoursePlatform table if they are selected
};

type GetOrCreateDiscoursePlatformReturn = {
  platform: DiscoursePlatformRecord | null;
  error: string | null;
  details?: string;
  created: boolean; // 'created' should always be boolean
};

type DiscoursePlatformDataInput = {
  currentContentURL: string;
};

async function getOrCreateDiscoursePlatform(
  supabase: SupabaseClient<any, "public", any>,
  currentContentURL: string,
): Promise<GetOrCreateDiscoursePlatformReturn> {
  let platformName: string | null = null;
  let platformUrl: string | null = null;
  const lowerCaseURL = currentContentURL.toLowerCase();

  if (lowerCaseURL.includes("roamresearch.com")) {
    platformName = "roamresearch";
    platformUrl = "https://roamresearch.com"; // Canonical URL
  } else {
    console.warn("Could not determine platform from URL:", currentContentURL);
    return {
      error: "Could not determine platform from URL",
      platform: null,
      created: false,
    };
  }

  if (!platformName || !platformUrl) {
    return {
      error: "Platform name or URL could not be derived",
      platform: null,
      created: false,
    };
  }

  // Try to find an existing platform by its canonical URL (which should be unique)
  const { data: existingPlatform, error: fetchError } = await supabase
    .from("DiscoursePlatform")
    .select("id, name, url")
    .eq("url", platformUrl)
    .maybeSingle<DiscoursePlatformRecord>();

  if (fetchError) {
    console.error("Error fetching DiscoursePlatform:", fetchError);
    return {
      error: "Database error while fetching platform",
      platform: null,
      details: fetchError.message,
      created: false,
    };
  }

  if (existingPlatform) {
    console.log("Found existing DiscoursePlatform:", existingPlatform);
    return { error: null, platform: existingPlatform, created: false };
  } else {
    console.log(
      `DiscoursePlatform "${platformName}" (URL: ${platformUrl}) not found, creating new one...`,
    );

    const platformToInsert = {
      name: platformName,
      url: platformUrl,
    };

    const { data: newPlatform, error: insertError } = await supabase
      .from("DiscoursePlatform")
      .insert(platformToInsert)
      .select("id, name, url") // Ensure selected fields match DiscoursePlatformRecord
      .single<DiscoursePlatformRecord>(); // Expecting one row to be inserted and returned

    if (insertError) {
      console.error("Error inserting new DiscoursePlatform:", insertError);
      // Handle potential race condition where platform was created between fetch and insert
      if (insertError.code === "23505") {
        // Unique constraint violation
        console.warn(
          "Unique constraint violation on insert. Attempting to re-fetch platform by URL.",
        );
        const { data: reFetchedPlatform, error: reFetchError } = await supabase
          .from("DiscoursePlatform")
          .select("id, name, url")
          .eq("url", platformUrl)
          .maybeSingle<DiscoursePlatformRecord>();

        if (reFetchError) {
          console.error(
            "Error re-fetching DiscoursePlatform after unique constraint violation:",
            reFetchError,
          );
          return {
            error: "Database error after unique constraint violation",
            platform: null,
            details: reFetchError.message,
            created: false,
          };
        }
        if (reFetchedPlatform) {
          console.log("Found platform on re-fetch:", reFetchedPlatform);
          return { error: null, platform: reFetchedPlatform, created: false }; // It existed, wasn't "created" by this call
        }
        // If re-fetch also fails to find it, the original insert error stands
        return {
          error:
            "Unique constraint violation on insert, and re-fetch failed to find the platform.",
          platform: null,
          details: insertError.message,
          created: false,
        };
      }
      return {
        error: "Database error while inserting platform",
        platform: null,
        details: insertError.message,
        created: false,
      };
    }

    console.log("Created new DiscoursePlatform:", newPlatform);
    return { error: null, platform: newPlatform, created: true };
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: DiscoursePlatformDataInput = await request.json();
    const { currentContentURL } = body;

    if (!currentContentURL || typeof currentContentURL !== "string") {
      response = NextResponse.json(
        { error: "Missing or invalid currentContentURL in request body" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }

    const result = await getOrCreateDiscoursePlatform(
      supabase,
      currentContentURL,
    );

    if (result.error) {
      console.error(
        `API Error for DiscoursePlatform (URL: ${currentContentURL}): ${result.error}`,
        result.details || "",
      );
      response = NextResponse.json(
        { error: result.error, details: result.details },
        { status: 500 },
      );
    } else if (result.platform) {
      response = NextResponse.json(result.platform, {
        status: result.created ? 201 : 200,
      });
    } else {
      // This case should ideally be caught by the 'error' field in the result
      console.error(
        `API Error for DiscoursePlatform (URL: ${currentContentURL}): Platform was null without an error flag.`,
      );
      response = NextResponse.json(
        {
          error:
            "Failed to get or create DiscoursePlatform for an unknown reason",
        },
        { status: 500 },
      );
    }
  } catch (e: unknown) {
    console.error(
      "API route error in /api/supabase/insert/discourse-platform:",
      e,
    );
    // Differentiate between JSON parsing errors and other errors
    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      response = NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    } else {
      response = NextResponse.json(
        {
          error:
            e instanceof Error
              ? e.message
              : "An unexpected error occurred processing your request",
        },
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
