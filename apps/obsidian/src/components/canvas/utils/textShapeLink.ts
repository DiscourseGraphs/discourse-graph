import { T } from "tldraw";

type TextShapeRecord = {
  typeName: string;
  type: string;
  props: Record<string, unknown>;
};

// An allowlist, not a parse check: the link renders as <a href>, so admitting
// arbitrary protocols would make `javascript:` an XSS vector.
const ALLOWED_WEB_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

// Only obsidian://open?...file=... is allowed. A bare `obsidian:` check would
// also admit action URIs like advanced-uri's commandid, letting a shared canvas
// run commands in the reader's vault with one click.
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

// Wider than tldraw's T.linkUrl, which rejects obsidian:// page links.
export const textLinkUrl = T.string.check((value) => {
  if (!isAllowedTextLinkUrl(value)) {
    throw new T.ValidationError(
      `Expected a valid url, got ${JSON.stringify(value)}`,
    );
  }
});

export const isTextShapeRecord = (
  record: unknown,
): record is TextShapeRecord => {
  if (typeof record !== "object" || record === null) return false;
  const { typeName, type, props } = record as Partial<TextShapeRecord>;
  return typeName === "shape" && type === "text" && typeof props === "object";
};

// Never overwrite an existing url: the equivalent Roam migration shipped an
// unconditional assignment and had to be corrected (PR #916).
export const backfillTextShapeUrl = (record: unknown): void => {
  if (!isTextShapeRecord(record)) return;
  if (record.props.url === undefined) record.props.url = "";
};
