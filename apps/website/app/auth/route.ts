import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  buildDecapCallbackUrl,
  DECAP_STATE_COOKIE_NAME,
  getDecapOAuthEnv,
  resolveDecapBaseUrl,
} from "~/utils/decap/oauth";

const STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10;
const DEFAULT_GITHUB_SCOPE = "repo";

const buildGitHubAuthorizeUrl = ({
  clientId,
  redirectUri,
  scope,
  state,
}: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
}): string => {
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");

  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", scope);
  authorizeUrl.searchParams.set("state", state);

  return authorizeUrl.toString();
};

export const GET = (request: NextRequest): NextResponse => {
  try {
    const { DECAP_GITHUB_CLIENT_ID } = getDecapOAuthEnv();
    const state = randomBytes(24).toString("hex");
    const scope =
      request.nextUrl.searchParams.get("scope")?.trim() || DEFAULT_GITHUB_SCOPE;
    const baseUrl = resolveDecapBaseUrl(request.nextUrl.origin);
    const redirectUri = buildDecapCallbackUrl(request.nextUrl.origin);
    const response = NextResponse.redirect(
      buildGitHubAuthorizeUrl({
        clientId: DECAP_GITHUB_CLIENT_ID,
        redirectUri,
        scope,
        state,
      }),
    );

    response.cookies.set({
      name: DECAP_STATE_COOKIE_NAME,
      value: state,
      httpOnly: true,
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: baseUrl.startsWith("https://"),
    });
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    console.error("Error starting Decap OAuth flow:", error);

    return NextResponse.json(
      { error: "Unable to start the Decap OAuth flow." },
      { status: 500 },
    );
  }
};
