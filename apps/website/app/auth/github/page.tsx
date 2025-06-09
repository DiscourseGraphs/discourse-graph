import ClientCallbackHandler from "~/auth/ClientCallbackHandler";

type Props = {
  searchParams: Promise<{ code?: string; state?: string }>;
};

const Page = async ({ searchParams }: Props) => {
  const { code, state } = await searchParams;

  // TODO zod validate the response
  const { accessToken: accessTokenByCode } = await fetch("/api/access-token", {
    method: "POST",
    body: JSON.stringify({ code }),
  }).then((r) => r.json());

  return (
    <ClientCallbackHandler accessToken={accessTokenByCode} state={state} />
  );
};

export default Page;
