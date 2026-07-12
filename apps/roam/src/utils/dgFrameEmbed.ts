// Parsing/serialization for the `{{dg-frame: ...}}` block embed.
//
// Serialized forms (the frame argument is optional):
//   {{dg-frame: [[Canvas Page Title]]}}                          frameless embed
//   {{dg-frame: [[Canvas Page Title]] "Frame Name"}}             name only (hand-written / self-healed)
//   {{dg-frame: [[Canvas Page Title]] "Frame Name" shape:abc}}   id-anchored (what the picker writes)
//   {{dg-frame: [[Canvas Page Title]] shape:abc}}                id only (name omitted)
//
// Frames are referenced by tldraw shape id (stable across renames and moves);
// the display name is carried alongside for human readability and as a
// resolution fallback. `shape:` is a plain token — we deliberately avoid Roam's
// `((...))` block-ref syntax so the embed round-trips through block text
// unambiguously.

export type DgFrameEmbed = {
  title: string;
  frameName?: string;
  // Full tldraw shape id, e.g. "shape:abc123" (tldraw ids use the nanoid
  // alphabet: A-Z a-z 0-9 _ -).
  frameShapeId?: string;
};

// Group 1: page title. Group 2: optional frame name. Group 3: optional shape id
// (captured with its `shape:` prefix, so it is the full tldraw id).
export const DG_FRAME_EMBED_REGEX =
  /\{\{dg-frame:\s*\[\[(.+?)\]\](?:\s+"([^"]*)")?(?:\s+(shape:[A-Za-z0-9_-]+))?\s*\}\}/i;

export const parseDgFrameEmbed = (blockText: string): DgFrameEmbed | null => {
  const match = blockText.match(DG_FRAME_EMBED_REGEX);
  if (!match) return null;

  const title = match[1].trim();
  if (!title) return null;

  const frameName = match[2]?.trim() || undefined;
  const frameShapeId = match[3] || undefined;

  return {
    title,
    ...(frameName ? { frameName } : {}),
    ...(frameShapeId ? { frameShapeId } : {}),
  };
};

export const serializeDgFrameEmbed = ({
  title,
  frameName,
  frameShapeId,
}: DgFrameEmbed): string => {
  let inner = `dg-frame: [[${title}]]`;
  // The name is only ever a readability/fallback hint (the id is authoritative),
  // so collapse any embedded double-quote to keep the token unambiguous.
  if (frameName) inner += ` "${frameName.replace(/"/g, "'")}"`;
  if (frameShapeId) inner += ` ${frameShapeId}`;
  return `{{${inner}}}`;
};
