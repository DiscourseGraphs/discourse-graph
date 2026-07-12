// One-shot "zoom to this frame when the canvas page next opens" hint, written
// by a frame snapshot's "Open canvas" button and consumed by the full-page
// canvas on mount. sessionStorage scopes it to the tab; the TTL guards against
// a hint written just before the user navigated somewhere else entirely and
// only hitting the canvas much later.

export type FrameZoomHint = { name?: string; shapeId?: string };

type HintStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const MAX_AGE_MS = 2 * 60 * 1000;

const keyFor = (pageUid: string): string =>
  `dg-canvas:zoom-to-frame:${pageUid}`;

const defaultStorage = (): HintStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    // Storage access can throw in sandboxed/embedded contexts.
    return null;
  }
};

export const writeFrameZoomHint = ({
  pageUid,
  frame,
  storage = defaultStorage(),
  now = Date.now(),
}: {
  pageUid: string;
  frame: FrameZoomHint;
  storage?: HintStorage | null;
  now?: number;
}): void => {
  if (!storage) return;
  if (!frame.name && !frame.shapeId) return;
  try {
    storage.setItem(
      keyFor(pageUid),
      JSON.stringify({ ...frame, savedAt: now }),
    );
  } catch {
    // Quota/security errors just mean no zoom-on-arrival — never break the click.
  }
};

export const consumeFrameZoomHint = ({
  pageUid,
  storage = defaultStorage(),
  now = Date.now(),
}: {
  pageUid: string;
  storage?: HintStorage | null;
  now?: number;
}): FrameZoomHint | null => {
  if (!storage) return null;
  try {
    const raw = storage.getItem(keyFor(pageUid));
    // One-shot: clear before parsing so a corrupt value can't stick around.
    if (raw !== null) storage.removeItem(keyFor(pageUid));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { name, shapeId, savedAt } = parsed as {
      name?: unknown;
      shapeId?: unknown;
      savedAt?: unknown;
    };
    if (typeof savedAt !== "number" || now - savedAt > MAX_AGE_MS) return null;
    const hint: FrameZoomHint = {
      ...(typeof name === "string" && name ? { name } : {}),
      ...(typeof shapeId === "string" && shapeId ? { shapeId } : {}),
    };
    return hint.name || hint.shapeId ? hint : null;
  } catch {
    return null;
  }
};
