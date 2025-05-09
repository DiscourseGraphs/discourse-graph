import { createClient } from "~/utils/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

interface PlatformResult {
  platform: any | null;
  error: string | null;
  details?: string;
  created?: boolean;
}

async function getOrCreateDiscoursePlatform(
  supabase: SupabaseClient<any, "public", any>, // Using a more specific type for SupabaseClient
  currentContentURL: string,
): Promise<PlatformResult> {
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
    .maybeSingle();

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
      .select()
      .single(); // Expecting one row to be inserted and returned

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
          .maybeSingle();

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

export async function POST(request: Request) {
  const supabase = await createClient(); // Creates a server-side Supabase client

  try {
    const body = await request.json();
    const { currentContentURL } = body;

    if (!currentContentURL || typeof currentContentURL !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid currentContentURL in request body" },
        { status: 400 },
      );
    }

    const { platform, error, details, created } =
      await getOrCreateDiscoursePlatform(supabase, currentContentURL);

    if (error) {
      console.error(
        `API Error for DiscoursePlatform (URL: ${currentContentURL}): ${error}`,
        details || "",
      );
      return NextResponse.json(
        { error: error, details: details },
        { status: 500 },
      );
    }

    if (platform) {
      return NextResponse.json(platform, { status: created ? 201 : 200 });
    } else {
      // This case should ideally be caught by the 'error' field in the result
      console.error(
        `API Error for DiscoursePlatform (URL: ${currentContentURL}): Platform was null without an error flag.`,
      );
      return NextResponse.json(
        {
          error:
            "Failed to get or create DiscoursePlatform for an unknown reason",
        },
        { status: 500 },
      );
    }
  } catch (e: any) {
    console.error(
      "API route error in /api/supabase/insert/DiscoursePlatform:",
      e,
    );
    // Differentiate between JSON parsing errors and other errors
    if (e instanceof SyntaxError && e.message.includes("JSON")) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      {
        error:
          e.message || "An unexpected error occurred processing your request",
      },
      { status: 500 },
    );
  }
}
