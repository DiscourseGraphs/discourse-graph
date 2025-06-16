import { NextResponse } from "next/server";

const CLIENT_ID =
  process.env.NODE_ENV === "production"
    ? process.env.GH_CLIENT_ID_PROD!
    : process.env.GH_CLIENT_ID_DEV!;
const CLIENT_SECRET =
  process.env.NODE_ENV === "production"
    ? process.env.GH_CLIENT_SECRET_PROD!
    : process.env.GH_CLIENT_SECRET_DEV!;
const REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? "https://discourse-graph-git-roam-github-sync-discourse-graphs.vercel.app/auth/github"
    : "https://43b0516e8c41.ngrok.app/auth/github";

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
        }),
      },
    );

    if (!tokenRes.ok) {
      throw new Error("Failed to exchange code for token");
    }

    const data = await tokenRes.json();
    const { access_token } = data;
    return NextResponse.json({ accessToken: access_token });
  } catch (error) {
    console.error("Error exchanging code for token:", error);
    return NextResponse.json(
      { error: "Failed to exchange code for token" },
      { status: 500 },
    );
  }
};
