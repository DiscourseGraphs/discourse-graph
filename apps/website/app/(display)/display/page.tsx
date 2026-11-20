import { notFound, redirect } from "next/navigation";
import {
  nodeDisplayPath,
  nodePathFromRid,
} from "~/utils/conversion/nodeAddress";

type DisplayLookupProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Looks a node up by RID, for callers that hold only a RID, such as a
// plugin's "open on the web" action. Redirects to the readable address.
const DisplayLookup = async ({
  searchParams,
}: DisplayLookupProps): Promise<never> => {
  const { rid } = await searchParams;
  const nodePath = typeof rid === "string" ? nodePathFromRid(rid) : undefined;
  if (!nodePath) notFound();
  redirect(nodeDisplayPath(nodePath));
};

export default DisplayLookup;
