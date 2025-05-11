import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface DiscourseSpaceData {
  name: string;
  url: string;
  discourse_platform_id: number;
}

interface DiscourseSpaceResult {
  space: any | null;
  error: string | null;
  details?: string;
  created?: boolean;
}

async function getOrCreateDiscourseSpace(
  supabase: SupabaseClient<any, "public", any>,
  name: string,
  url: string,
  discoursePlatformId: number,
): Promise<DiscourseSpaceResult> {
  if (
    !name ||
    !url ||
    discoursePlatformId === undefined ||
    discoursePlatformId === null
  ) {
    return {
      error: "DiscourseSpace name, URL, and discourse_platform_id are required",
      space: null,
      created: false,
    };
  }

  const normalizedUrl = url.replace(/\/$/, "");

  const { data: existingSpace, error: fetchError } = await supabase
    .from("DiscourseSpace")
    .select("id, name, url, discourse_platform_id")
    .eq("url", normalizedUrl)
    .eq("discourse_platform_id", discoursePlatformId)
    .maybeSingle();

  if (fetchError) {
    console.error(
      `Error fetching DiscourseSpace (URL: ${normalizedUrl}, PlatformID: ${discoursePlatformId}):`,
      fetchError,
    );
    return {
      error: "Database error while fetching DiscourseSpace",
      space: null,
      details: fetchError.message,
      created: false,
    };
  }

  if (existingSpace) {
    console.log("Found existing DiscourseSpace:", existingSpace);
    return { error: null, space: existingSpace, created: false };
  } else {
    console.log(
      `DiscourseSpace "${name}" (URL: ${normalizedUrl}, PlatformID: ${discoursePlatformId}) not found, creating new one...`,
    );

    const spaceToInsert = {
      name: name,
      url: normalizedUrl,
      discourse_platform_id: discoursePlatformId,
    };

    const { data: newSpace, error: insertError } = await supabase
      .from("DiscourseSpace")
      .insert(spaceToInsert)
      .select("id, name, url, discourse_platform_id")
      .single();

    if (insertError) {
      console.error(
        `Error inserting new DiscourseSpace (Name: ${name}, URL: ${normalizedUrl}, PlatformID: ${discoursePlatformId}):`,
        insertError,
      );
      if (insertError.code === "23505") {
        console.warn(
          "Unique constraint violation on insert. Attempting to re-fetch DiscourseSpace.",
        );
        const { data: reFetchedSpace, error: reFetchError } = await supabase
          .from("DiscourseSpace")
          .select("id, name, url, discourse_platform_id")
          .eq("url", normalizedUrl)
          .eq("discourse_platform_id", discoursePlatformId)
          .maybeSingle();

        if (reFetchError) {
          console.error(
            "Error re-fetching DiscourseSpace after unique constraint violation:",
            reFetchError,
          );
          return {
            error: "Database error after unique constraint violation",
            space: null,
            details: reFetchError.message,
            created: false,
          };
        }
        if (reFetchedSpace) {
          console.log("Found DiscourseSpace on re-fetch:", reFetchedSpace);
          return { error: null, space: reFetchedSpace, created: false };
        }
        return {
          error:
            "Unique constraint violation on insert, and re-fetch failed to find the DiscourseSpace.",
          space: null,
          details: insertError.message,
          created: false,
        };
      }
      return {
        error: "Database error while inserting DiscourseSpace",
        space: null,
        details: insertError.message,
        created: false,
      };
    }

    console.log("Created new DiscourseSpace:", newSpace);
    return { error: null, space: newSpace, created: true };
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: DiscourseSpaceData = await request.json();
    const { name, url, discourse_platform_id } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      response = NextResponse.json(
        { error: "Missing or invalid name in request body" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (!url || typeof url !== "string" || url.trim() === "") {
      response = NextResponse.json(
        { error: "Missing or invalid url in request body" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (
      discourse_platform_id === undefined ||
      discourse_platform_id === null ||
      typeof discourse_platform_id !== "number"
    ) {
      response = NextResponse.json(
        { error: "Missing or invalid discourse_platform_id in request body" },
        { status: 400 },
      );
      return cors(request, response);
    }

    const { space, error, details, created } = await getOrCreateDiscourseSpace(
      supabase,
      name.trim(),
      url.trim(),
      discourse_platform_id,
    );

    if (error) {
      console.error(
        `API Error for DiscourseSpace (Name: ${name}, URL: ${url}, PlatformID: ${discourse_platform_id}): ${error}`,
        details || "",
      );
      const clientError = error.startsWith("Database error")
        ? "An internal error occurred while processing the DiscourseSpace information."
        : error;
      response = NextResponse.json(
        {
          error: clientError,
          details: error.startsWith("Database error") ? undefined : details,
        },
        { status: 500 },
      );
    } else {
      if (space) {
        response = NextResponse.json(space, { status: created ? 201 : 200 });
      } else {
        console.error(
          `API Error for DiscourseSpace (Name: ${name}, URL: ${url}, PlatformID: ${discourse_platform_id}): Space was null without an error flag.`,
        );
        response = NextResponse.json(
          {
            error:
              "Failed to get or create DiscourseSpace for an unknown reason",
          },
          { status: 500 },
        );
      }
    }
  } catch (e: any) {
    console.error("API route error in /api/supabase/insert/DiscourseSpace:", e);
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
