import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface PlatformDataInput {
  name: string;
  url: string;
}

interface PlatformResult {
  platform: any | null;
  error: string | null;
  details?: string;
  created?: boolean;
}

async function getOrCreateDiscoursePlatform(
  supabase: SupabaseClient<any, "public", any>,
  name: string,
  url: string,
): Promise<PlatformResult> {
  if (!name || !url) {
    return {
      error: "Platform name and URL are required",
      platform: null,
      created: false,
    };
  }

  const normalizedUrl = url.replace(/\/$/, "");

  const { data: existingPlatform, error: fetchError } = await supabase
    .from("DiscoursePlatform")
    .select("id, name, url")
    .eq("url", normalizedUrl)
    .maybeSingle();

  if (fetchError) {
    console.error(
      `Error fetching DiscoursePlatform (URL: ${normalizedUrl}):`,
      fetchError,
    );
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
      `DiscoursePlatform "${name}" (URL: ${normalizedUrl}) not found, creating new one...`,
    );
    const platformToInsert = {
      name: name,
      url: normalizedUrl,
    };
    const { data: newPlatform, error: insertError } = await supabase
      .from("DiscoursePlatform")
      .insert(platformToInsert)
      .select("id, name, url")
      .single();

    if (insertError) {
      console.error(
        `Error inserting new DiscoursePlatform (Name: ${name}, URL: ${normalizedUrl}):`,
        insertError,
      );
      if (insertError.code === "23505") {
        console.warn(
          "Unique constraint violation on insert. Attempting to re-fetch platform by URL.",
        );
        const { data: reFetchedPlatform, error: reFetchError } = await supabase
          .from("DiscoursePlatform")
          .select("id, name, url")
          .eq("url", normalizedUrl)
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
          return { error: null, platform: reFetchedPlatform, created: false };
        }
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

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: PlatformDataInput = await request.json();
    const { name, url } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      response = NextResponse.json(
        { error: "Missing or invalid name in request body" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (!url || typeof url !== "string" || url.trim() === "") {
      response = NextResponse.json(
        { error: "Missing or invalid url in request body" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }

    const { platform, error, details, created } =
      await getOrCreateDiscoursePlatform(supabase, name.trim(), url.trim());

    if (error) {
      console.error(
        `API Error for DiscoursePlatform (Name: ${name}, URL: ${url}): ${error}`,
        details || "",
      );
      const clientError = error.startsWith("Database error")
        ? "An internal error occurred while processing the platform information."
        : error;
      response = NextResponse.json(
        {
          error: clientError,
          details: error.startsWith("Database error") ? undefined : details,
        },
        { status: 500 },
      );
    } else {
      if (platform) {
        response = NextResponse.json(platform, { status: created ? 201 : 200 });
      } else {
        console.error(
          `API Error for DiscoursePlatform (Name: ${name}, URL: ${url}): Platform was null without an error flag.`,
        );
        response = NextResponse.json(
          {
            error:
              "Failed to get or create DiscoursePlatform for an unknown reason",
          },
          { status: 500 },
        );
      }
    }
  } catch (e: any) {
    console.error(
      "API route error in /api/supabase/insert/DiscoursePlatform:",
      e,
    );
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
  return cors(request, response) as NextResponse;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}
