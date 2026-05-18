import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";
import internalError from "~/utils/internalErrorSsr";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const params = request.nextUrl.searchParams;
  const token = params.get("t");
  const url = params.get("url");
  try {
    if (typeof token !== "string") throw new Error("Please provide a token");
    if (typeof url !== "string") throw new Error("Please provide a single URL");
    if (
      url.indexOf("://") >= 0 &&
      !url.startsWith(request.nextUrl.origin + "/")
    )
      throw new Error("Absolute URLs should be within the application");

    const client = await createClient();
    const result = await client.rpc("get_secret_token", {
      token,
    });
    if (result.error) {
      internalError({ error: result.error, type: "get-secret-token" });
      throw new Error("Could not connect to DiscourseGraphs");
    }
    if (result.data == null) {
      internalError({ error: "missing token", type: "get-secret-token" });
      throw new Error("Could not retrieve information, please try again.");
    }
    if (typeof result.data !== "string") {
      internalError({
        error: "payload-not-string",
        type: "get-secret-token",
      });
      throw new Error(
        "DiscourseGraphs configuration error, the team has been warned",
      );
    }
    const data = JSON.parse(result.data) as {
      /* eslint-disable @typescript-eslint/naming-convention */
      access_token: string;
      refresh_token: string;
      /* eslint-enable @typescript-eslint/naming-convention */
    };
    if (
      !data ||
      typeof data !== "object" ||
      !data.access_token ||
      !data.refresh_token
    ) {
      internalError({ error: "misshaped-payload", type: "get-secret-token" });
      throw new Error(
        "DiscourseGraphs configuration error, the team has been warned",
      );
    }
    const response = await client.auth.setSession(data);
    if (response.error) {
      throw response.error;
    }
  } catch (error) {
    return NextResponse.redirect(
      new URL(
        "/auth/error?error=" +
          encodeURIComponent(
            error instanceof Error
              ? error.message
              : "Unkown error while logging you in.",
          ),
        request.nextUrl,
      ),
    );
  }
  return NextResponse.redirect(
    new URL(url, url.startsWith("http") ? undefined : request.nextUrl),
  );
};
