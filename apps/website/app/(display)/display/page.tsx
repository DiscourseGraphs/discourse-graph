import { notFound, redirect } from "next/navigation";

const DisplayPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ rid?: string | string[] }>;
}): Promise<never> => {
  const { rid } = await searchParams;
  if (typeof rid !== "string" || !rid) notFound();
  redirect(`/id/${encodeURIComponent(rid)}`);
};

export default DisplayPage;
