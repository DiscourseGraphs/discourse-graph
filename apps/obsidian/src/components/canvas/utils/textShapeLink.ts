import type { TLShape } from "tldraw";

// An allowlist, not a parse check: the link renders as <a href>, so admitting
// arbitrary protocols would make `javascript:` an XSS vector.
const ALLOWED_WEB_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

// Only obsidian://open?...file=... -- a bare `obsidian:` check would admit
// action URIs like advanced-uri's commandid from a shared canvas.
const isAllowedObsidianUrl = (url: URL): boolean =>
  // obsidian: is a non-special scheme, so WHATWG leaves the host case alone.
  url.host.toLowerCase() === "open" && !!url.searchParams.get("file");

export const isAllowedTextLinkUrl = (value: string): boolean => {
  if (value === "") return true;
  try {
    const url = new URL(value);
    const protocol = url.protocol.toLowerCase();
    if (protocol === "obsidian:") return isAllowedObsidianUrl(url);
    return ALLOWED_WEB_PROTOCOLS.has(protocol);
  } catch {
    return false;
  }
};

export const isObsidianUrl = (url: string): boolean => {
  try {
    return new URL(url).protocol.toLowerCase() === "obsidian:";
  } catch {
    return false;
  }
};

// Returns the parsed form: `new URL` strips leading control characters, so a
// raw value could pass this allowlist and fail a prefix test further on.
export const getTextShapeLinkUrl = (shape: TLShape): string => {
  const raw = (shape.meta as { url?: unknown }).url;
  if (typeof raw !== "string" || !isAllowedTextLinkUrl(raw)) return "";
  try {
    return new URL(raw).toString();
  } catch {
    return "";
  }
};
