import { T, TLShape } from "tldraw";

// meta is unvalidated, so this is the only guard before an href. Returning the
// parsed form keeps the href identical to what passed validation.
export const getTextShapeLinkUrl = (shape: TLShape): string | undefined => {
  if (shape.type !== "text") return undefined;
  const { url } = shape.meta;
  if (typeof url !== "string" || !T.linkUrl.isValid(url)) return undefined;
  try {
    // linkUrl resolves relative paths against a dummy origin; only absolute URLs render.
    return new URL(url).href;
  } catch {
    return undefined;
  }
};
