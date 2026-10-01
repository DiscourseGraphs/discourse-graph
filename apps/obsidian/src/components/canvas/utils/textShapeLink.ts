import type { TLShape } from "tldraw";

// An allowlist, not a parse check: the link renders as <a href>, so admitting
// arbitrary protocols would make `javascript:` an XSS vector.
const ALLOWED_WEB_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

// Only obsidian://open?...file=... -- a bare `obsidian:` check would admit
// action URIs like advanced-uri's commandid from a shared canvas.
const isAllowedObsidianUrl = (url: URL): boolean =>
  url.host === "open" && !!url.searchParams.get("file");

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

export const isObsidianUrl = (url: string): boolean =>
  url.toLowerCase().startsWith("obsidian:");

// Text links live in `meta`, which tldraw validates as arbitrary JSON, so every
// read is untrusted: a hand-edited or synced canvas can hold anything.
export const getTextShapeLinkUrl = (shape: TLShape): string => {
  const url = (shape.meta as { url?: unknown }).url;
  return typeof url === "string" && isAllowedTextLinkUrl(url) ? url : "";
};
