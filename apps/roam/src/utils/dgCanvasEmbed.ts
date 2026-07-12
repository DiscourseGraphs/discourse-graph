// Parsing/serialization for the `{{dg-canvas: ...}}` block embed.
//
// One syntax covers both the classic whole-canvas embed and the frame-anchored
// embed (the frame argument is optional):
//   {{dg-canvas: [[Canvas Page Title]]}}                           whole canvas (classic embed)
//   {{dg-canvas: [[Canvas Page Title]] "Frame Name"}}              frame by name (hand-written)
//   {{dg-canvas: [[Canvas Page Title]] "Frame Name" shape:abc}}    frame by id (what the picker writes)
//   {{dg-canvas: [[Canvas Page Title]] shape:abc}}                 frame by id (name omitted)
//   {{dg-canvas: [[Canvas Page Title]] "Frame Name" shape:abc live}}  frame, live editor (see below)
//
// Frame-anchored embeds render as a static snapshot by default; a trailing
// `live` token (lowercase, always last) opts back into the interactive editor.
//
// Frames are referenced by tldraw shape id (stable across renames and moves);
// the display name is carried alongside for human readability and as a
// resolution fallback. `shape:` is a plain token — we deliberately avoid Roam's
// `((...))` block-ref syntax so the embed round-trips through block text
// unambiguously.
//
// Degradation contract: a tail that does not parse as `"name"`/`shape:id` is
// ignored (whole-canvas embed), and a frame argument that matches no frame on
// the canvas is likewise ignored by the renderer — a broken frame reference
// must never cost the user their canvas.

export type DgCanvasEmbed = {
  title: string;
  frameName?: string;
  // Full tldraw shape id, e.g. "shape:abc123" (tldraw ids use the nanoid
  // alphabet: A-Z a-z 0-9 _ -).
  frameShapeId?: string;
  // Frame embeds only: force the interactive editor instead of the default
  // static snapshot.
  live?: boolean;
};

// Group 1: page title. Group 2: everything between the closing `]]` and the
// `}}` terminator, parsed separately so a malformed frame argument degrades to a
// whole-canvas embed instead of a dead button. The tail is lazy (`[\s\S]*?`, not
// `[^}]*`) on purpose: a lone `}` inside a frame name must not stop the match at
// the wrong place and make the whole embed fail to parse (which would blank the
// block rather than degrade) — the tail runs to the first `}}` and a stray `}`
// in the name is then handled by FRAME_ARGS_REGEX.
export const DG_CANVAS_EMBED_REGEX =
  /\{\{dg-canvas:\s*\[\[(.+?)\]\]([\s\S]*?)\}\}/i;

// The tail only counts as a frame reference if it is exactly an optional
// quoted frame name followed by an optional shape-id token, optionally
// followed by the `live` modifier. Kept case-sensitive: shape ids are
// case-sensitive, and a canonical lowercase `live` keeps the degradation
// rule simple (anything else in the tail → whole-canvas embed).
const FRAME_ARGS_REGEX =
  /^\s*(?:"([^"]*)"\s*)?(shape:[A-Za-z0-9_-]+)?\s*(live)?\s*$/;

export const parseDgCanvasEmbed = (blockText: string): DgCanvasEmbed | null => {
  const match = blockText.match(DG_CANVAS_EMBED_REGEX);
  if (!match) return null;

  const title = match[1].trim();
  if (!title) return null;

  const frameArgs = match[2].match(FRAME_ARGS_REGEX);
  const frameName = frameArgs?.[1]?.trim() || undefined;
  const frameShapeId = frameArgs?.[2] || undefined;

  return {
    title,
    ...(frameName ? { frameName } : {}),
    ...(frameShapeId ? { frameShapeId } : {}),
    ...(frameArgs?.[3] ? { live: true } : {}),
  };
};

export const serializeDgCanvasEmbed = ({
  title,
  frameName,
  frameShapeId,
  live,
}: DgCanvasEmbed): string => {
  let inner = `dg-canvas: [[${title}]]`;
  // The name is only ever a readability/fallback hint (the id is authoritative),
  // so collapse characters that would break the token: double-quotes (which
  // delimit the name) and curly braces (which would collide with Roam's
  // `{{ }}` component syntax and the parser's `}}` terminator).
  const safeName = frameName?.replace(/"/g, "'").replace(/[{}]/g, "");
  if (safeName) inner += ` "${safeName}"`;
  if (frameShapeId) inner += ` ${frameShapeId}`;
  if (live) inner += " live";
  return `{{${inner}}}`;
};

// How a frame-anchored embed should render. Pure so it is unit-testable: the
// caller supplies the canvas's effective sync mode. Sync-mode canvases fall
// back to the live embed because their block-props snapshot may lag the
// multiplayer room — an explicit `live` request is already the live editor,
// so the fallback distinction only matters for labeling.
export type FrameEmbedMode = "snapshot" | "live" | "live-sync-fallback";

export const getFrameEmbedMode = ({
  live,
  canvasSyncMode,
}: {
  live?: boolean;
  canvasSyncMode: "local" | "sync";
}): FrameEmbedMode =>
  live ? "live" : canvasSyncMode === "sync" ? "live-sync-fallback" : "snapshot";
