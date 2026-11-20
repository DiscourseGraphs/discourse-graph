import { headers } from "next/headers";

// Absolute URLs (JSON-LD addresses) need the origin the reader used.
export const requestOrigin = async (): Promise<string> => {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
};
