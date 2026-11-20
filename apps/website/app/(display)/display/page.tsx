import { notFound, redirect } from "next/navigation";
import {
  nodeDisplayPath,
  nodePathFromRid,
  spaceDisplayPath,
  spacePathFromSpaceUrl,
} from "~/utils/conversion/nodeAddress";

type DisplayLookupProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const lookupPath = ({
  rid,
  space,
}: {
  rid?: string | string[];
  space?: string | string[];
}): string | undefined => {
  if (typeof rid === "string") {
    const nodePath = nodePathFromRid(rid);
    return nodePath && nodeDisplayPath(nodePath);
  }
  if (typeof space === "string") {
    const spacePath = spacePathFromSpaceUrl(space);
    return spacePath && spaceDisplayPath(spacePath);
  }
  return undefined;
};

// Looks a node up by RID, or a space by its URL, for callers that hold only
// those, such as a plugin's "publish to the web". Redirects to the readable
// address.
const DisplayLookup = async ({
  searchParams,
}: DisplayLookupProps): Promise<never> => {
  const { rid, space } = await searchParams;
  const path = lookupPath({ rid, space });
  if (!path) notFound();
  redirect(path);
};

export default DisplayLookup;
