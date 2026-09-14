import { T } from "tldraw";

type UnknownRecord = {
  typeName?: unknown;
  type?: unknown;
  props?: Record<string, unknown>;
};

// An allowlist, not a parse check: the link renders as <a href>, so admitting
// arbitrary protocols would make `javascript:` an XSS vector.
const ALLOWED_LINK_PROTOCOLS = new Set([
  "http:",
  "https:",
  "mailto:",
  "obsidian:",
]);

export const isAllowedTextLinkUrl = (value: string): boolean => {
  if (value === "") return true;
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(value).protocol.toLowerCase());
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

export const isTextShapeRecord = (record: unknown): boolean => {
  if (typeof record !== "object" || record === null) return false;
  const { typeName, type, props } = record as UnknownRecord;
  return typeName === "shape" && type === "text" && typeof props === "object";
};

// tldraw gates its Edit link action on `'url' in shape.props`, so a text shape
// missing the key is silently ineligible rather than failing loudly.
export const hasLinkUrlProp = (record: unknown): boolean => {
  if (typeof record !== "object" || record === null) return false;
  const { props } = record as UnknownRecord;
  return typeof props === "object" && props !== null && "url" in props;
};

// Never overwrite an existing url: the equivalent Roam migration shipped an
// unconditional assignment and had to be corrected (PR #916).
export const backfillTextShapeUrl = (record: unknown): void => {
  if (!isTextShapeRecord(record)) return;
  const { props } = record as Required<UnknownRecord>;
  if (props.url === undefined) props.url = "";
};
