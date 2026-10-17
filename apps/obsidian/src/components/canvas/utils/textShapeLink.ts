import { T, type TLShape } from "tldraw";

// The patched tldraw validator is the single definition of a valid link, so geo
// shapes and text shapes agree on what obsidian:// forms are accepted.
export const isAllowedTextLinkUrl = (value: string): boolean =>
  T.linkUrl.isValid(value);

export const isObsidianUrl = (url: string): boolean => {
  try {
    return new URL(url).protocol.toLowerCase() === "obsidian:";
  } catch {
    return false;
  }
};

// Returns the parsed form: `new URL` strips leading control characters, so a
// raw value could pass the validator and fail a prefix test further on.
export const getTextShapeLinkUrl = (shape: TLShape): string => {
  const raw = (shape.meta as { url?: unknown }).url;
  if (typeof raw !== "string" || !isAllowedTextLinkUrl(raw)) return "";
  try {
    return new URL(raw).toString();
  } catch {
    return "";
  }
};
