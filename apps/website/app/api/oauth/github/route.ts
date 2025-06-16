import { NextResponse } from "next/server";

const CLIENT_ID =
  process.env.NODE_ENV === "production"
    ? "Iv23liZlGOO5JGe9DAd5"
    : process.env.GH_CLIENT_ID_DEV;
const CLIENT_SECRET =
  process.env.NODE_ENV === "production"
    ? process.env.GH_CLIENT_SECRET_PROD
    : process.env.GH_CLIENT_SECRET_DEV;

const REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? "https://discourse-graph-git-roam-github-sync-discourse-graphs.vercel.app/auth/github"
    : "https://43b0516e8c41.ngrok.app/auth/github";

// TODO is this route even needed, or can we do this on the server component?
export const POST = async (request: Request) => {
  const { code } = await request.json();

  if (!code) {
    const error = "Missing code";
    return NextResponse.json({ error }, { status: 400 });
  }
  if (!CLIENT_ID) {
    const error = "Missing client ID";
    return NextResponse.json({ error }, { status: 400 });
  }
  if (!CLIENT_SECRET) {
    const error = "Missing client secret";
    return NextResponse.json({ error }, { status: 400 });
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
