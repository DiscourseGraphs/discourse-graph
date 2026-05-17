/* eslint-disable @typescript-eslint/naming-convention */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildDecapCallbackUrl,
  DECAP_GITHUB_PROVIDER,
  DECAP_STATE_COOKIE_NAME,
  getDecapOAuthEnv,
} from "~/utils/decap/oauth";

const GitHubTokenResponseSchema = z.object({
  access_token: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

type GitHubTokenResponse = z.infer<typeof GitHubTokenResponseSchema>;

const buildOAuthMessage = ({
  status,
  payload,
}: {
  status: "error" | "success";
  payload: Record<string, unknown>;
}): string =>
  `authorization:${DECAP_GITHUB_PROVIDER}:${status}:${JSON.stringify(payload)}`;

const buildCallbackHtml = ({
  message,
}: {
  message: string;
}): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex,nofollow" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Decap CMS authentication</title>
  </head>
  <body>
    <p>Finishing authentication. You can close this window if it does not close automatically.</p>
    <script>
      (function() {
        const message = ${JSON.stringify(message)};

        if (!window.opener) {
          return;
        }

        function completeAuthorization(event) {
          window.removeEventListener("message", completeAuthorization, false);
          window.opener.postMessage(message, event.origin);
          window.close();
        }

        window.addEventListener("message", completeAuthorization, false);
        window.opener.postMessage("authorizing:${DECAP_GITHUB_PROVIDER}", "*");
      })();
    </script>
  </body>
</html>`;

const buildOAuthResponse = ({
  message,
  status = 200,
}: {
  message: string;
  status?: number;
}): NextResponse => {
  const response = new NextResponse(buildCallbackHtml({ message }), {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/html; charset=utf-8",
    },
    status,
  });

  response.cookies.delete(DECAP_STATE_COOKIE_NAME);

  return response;
};

const createErrorResponse = ({
  description,
  status,
}: {
  description: string;
  status?: number;
}): NextResponse =>
  buildOAuthResponse({
    message: buildOAuthMessage({
      payload: { error: description },
      status: "error",
    }),
    status,
  });

const exchangeGitHubCodeForToken = async ({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}): Promise<string> => {
  const { DECAP_GITHUB_CLIENT_ID, DECAP_GITHUB_CLIENT_SECRET } =
    getDecapOAuthEnv();
  const response = await fetch("https://github.com/login/oauth/access_token", {
    body: JSON.stringify({
      client_id: DECAP_GITHUB_CLIENT_ID,
      client_secret: DECAP_GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Discourse Graphs Decap OAuth",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed with ${response.status}.`);
  }

  const payload = (await response.json()) as GitHubTokenResponse;
  const parsedResponse = GitHubTokenResponseSchema.parse(payload);

  if (!parsedResponse.access_token) {
    throw new Error(
      parsedResponse.error_description ??
        parsedResponse.error ??
        "GitHub did not return an access token.",
    );
  }

  return parsedResponse.access_token;
};

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const state = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(DECAP_STATE_COOKIE_NAME)?.value;
  const oauthError =
    request.nextUrl.searchParams.get("error_description") ??
    request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");

  if (oauthError) {
    return createErrorResponse({
      description: oauthError,
      status: 400,
    });
  }

  if (!state || !storedState || storedState !== state) {
    return createErrorResponse({
      description: "OAuth state validation failed.",
      status: 400,
    });
  }

  if (!code) {
    return createErrorResponse({
      description: "Missing GitHub OAuth code.",
      status: 400,
    });
  }

  try {
    const accessToken = await exchangeGitHubCodeForToken({
      code,
      redirectUri: buildDecapCallbackUrl(request.nextUrl.origin),
    });

    return buildOAuthResponse({
      message: buildOAuthMessage({
        payload: {
          provider: DECAP_GITHUB_PROVIDER,
          token: accessToken,
        },
        status: "success",
      }),
    });
  } catch (error) {
    console.error("Error finishing Decap OAuth flow:", error);

    return createErrorResponse({
      description:
        error instanceof Error
          ? error.message
          : "Unable to complete the GitHub OAuth flow.",
      status: 500,
    });
  }
};
