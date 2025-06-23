import ClientCallbackHandler from "~/auth/ClientCallbackHandler";

type Props = {
  searchParams: Promise<{ code?: string; state?: string }>;
};

const ACCESS_TOKEN_URL =
  process.env.NODE_ENV === "development"
    ? "https://43b0516e8c41.ngrok.app/api/access-token"
    : "https://discourse-graph-git-roam-github-sync-discourse-graphs.vercel.app//api/access-token";

const GITHUB_AUTH_URL =
  process.env.NODE_ENV === "development"
    ? "https://43b0516e8c41.ngrok.app/api/oauth/github"
    : "https://discourse-graph-git-roam-github-sync-discourse-graphs.vercel.app/api/oauth/github";

const Page = async ({ searchParams }: Props) => {
  const { code, state } = await searchParams;
  try {
    // check if the access token is already in the database
    // TODO zod validate the response
    // const accessTokenResponse = await fetch(ACCESS_TOKEN_URL, {
    //   method: "POST",
    //   body: JSON.stringify({ code }),
    // });

    // if (!accessTokenResponse.ok) {
    //   return (
    //     <ClientCallbackHandler
    //       error={`HTTP error! status: ${accessTokenResponse.status}`}
    //     />
    //   );
    // }

    // const data = await accessTokenResponse.json();
    // const { accessToken } = data;

    // if (accessToken) {
    //   return <ClientCallbackHandler accessToken={accessToken} state={state} />;
    // }

    // if not, get the access token from github
    const githubAuthResponse = await fetch(GITHUB_AUTH_URL, {
      method: "POST",
      body: JSON.stringify({ code }),
    });

    if (!githubAuthResponse.ok) {
      console.error("githubAuthResponse", githubAuthResponse);
      return (
        <ClientCallbackHandler
          error={`HTTP error! status: ${githubAuthResponse.status}`}
        />
      );
    }

    const githubAuthData = await githubAuthResponse.json();
    const { accessToken: githubAccessToken } = githubAuthData;

    return (
      <ClientCallbackHandler accessToken={githubAccessToken} state={state} />
    );
  } catch (error) {
    console.error("Error in GitHub auth callback:", error);
    return <ClientCallbackHandler error="Failed to authenticate with GitHub" />;
  }
};

export default Page;
