import ClientCallbackHandler from "~/auth/ClientCallbackHandler";

type Props = {
  searchParams: Promise<{ code?: string; state?: string }>;
};

const API_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000/api/access-token"
    : "https://discoursegraphs.com/api/access-token";

console.log("API_URL", API_URL);

const Page = async ({ searchParams }: Props) => {
  const { code, state } = await searchParams;

  try {
    // TODO zod validate the response
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();

    if (!responseText) {
      throw new Error("Empty response received");
    }

    const accessTokenByCode = JSON.parse(responseText);

    return (
      <ClientCallbackHandler accessToken={accessTokenByCode} state={state} />
    );
  } catch (error) {
    console.error("Error in GitHub auth callback:", error);
    throw error;
  }
};

export default Page;
