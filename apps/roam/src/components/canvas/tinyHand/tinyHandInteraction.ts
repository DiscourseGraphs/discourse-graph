import type { Atom, Editor } from "tldraw";

type Point = { x: number; y: number };

const borrowedSelect = new WeakMap<Editor, () => void>();

export const finishTinyHandInteraction = (editor: Editor): void => {
  borrowedSelect.get(editor)?.();
};

export const listenForTinyHandInteraction = ({
  editor,
  canvas,
  toolId,
  interacting,
  restorePointer,
}: {
  editor: Editor;
  canvas: HTMLElement;
  toolId: string;
  interacting: Atom<boolean>;
  restorePointer: (point: Point | null) => void;
}): (() => void) => {
  const container = editor.getContainer();
  const document = container.ownerDocument;
  const view = document.defaultView!;
  const listeners = new AbortController();
  const capture = { capture: true, signal: listeners.signal };
  const pointers = new Set<number>();
  let held = false;
  let lastPoint: Point | null = null;
  let releaseTimer: number | undefined;
  let restoreDispatch: (() => void) | undefined;

  const finish = (): void => {
    held = false;
    restoreDispatch?.();
    restoreDispatch = undefined;
    interacting.set(false);
    borrowedSelect.delete(editor);
  };

  const restore = (): void => {
    if (!interacting.get()) return;
    editor.run(() => {
      if (editor.isIn("select")) editor.setCurrentTool(toolId);
      finish();
    });
    const hit =
      lastPoint && document.elementFromPoint(lastPoint.x, lastPoint.y);
    const bounds = canvas.getBoundingClientRect();
    restorePointer(
      lastPoint && hit && canvas.contains(hit)
        ? { x: lastPoint.x - bounds.left, y: lastPoint.y - bounds.top }
        : null,
    );
  };

  const sync = (): void => {
    if (pointers.size) return;
    if (!held) return restore();
    if (interacting.get() || !editor.isIn(toolId)) return;

    // Select normally interprets Alt-drag as duplicate. Consume only this
    // editor's modifier, leaving trusted DOM events intact for media controls.
    const dispatch = editor.dispatch;
    const withoutAlt: Editor["dispatch"] = (info) =>
      dispatch(
        "altKey" in info && info.altKey ? { ...info, altKey: false } : info,
      );
    editor.dispatch = withoutAlt;
    restoreDispatch = () => {
      if (editor.dispatch === withoutAlt) editor.dispatch = dispatch;
    };
    editor.inputs.altKey = false;
    borrowedSelect.set(editor, finish);
    editor.run(() => {
      interacting.set(true);
      editor.setCurrentTool("select");
    });
  };

  const keyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && interacting.get()) {
      event.stopPropagation();
      event.preventDefault();
      editor.cancel();
      editor.setCurrentTool("select.idle");
      finish();
      return;
    }
    if (
      event.key !== "Alt" ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.getModifierState("AltGraph") ||
      !editor.getIsFocused() ||
      (event.target instanceof Element &&
        event.target.closest("input, textarea, select, [contenteditable=true]"))
    )
      return;

    event.preventDefault();
    event.stopPropagation();
    held = true;
    sync();
  };

  const keyUp = (event: KeyboardEvent): void => {
    if (!held || event.key !== "Alt") return;
    event.preventDefault();
    event.stopPropagation();
    held = false;
    sync();
  };

  const trackPoint = (event: PointerEvent): void => {
    if (event.isPrimary && event.pointerType !== "touch")
      lastPoint = { x: event.clientX, y: event.clientY };
  };
  const pointerDown = (event: PointerEvent): void => {
    trackPoint(event);
    pointers.add(event.pointerId);
  };
  const pointerEnd = (event: PointerEvent): void => {
    if (!pointers.delete(event.pointerId)) return;
    trackPoint(event);
    // Native Select and browser controls must receive pointerup and click first.
    if (held !== interacting.get()) {
      view.clearTimeout(releaseTimer);
      releaseTimer = view.setTimeout(sync, 0);
    }
  };
  const reset = (): void => {
    held = false;
    pointers.clear();
    if (interacting.get() && editor.isIn("select")) editor.complete();
    restore();
  };

  const focusVideo = (event: Event): void => {
    const player = event.target;
    // Chromium's native playback button can keep the Alt release inside its
    // closed shadow tree. Return keyboard focus to the same playing surface.
    if (
      interacting.get() &&
      player instanceof HTMLVideoElement &&
      player.controls &&
      document.activeElement === player
    )
      player.focus({ preventScroll: true });
  };
  canvas.addEventListener("play", focusVideo, capture);
  canvas.addEventListener("pause", focusVideo, capture);
  container.addEventListener("keydown", keyDown, capture);
  view.addEventListener("keyup", keyUp, capture);
  canvas.addEventListener("pointerdown", pointerDown, capture);
  view.addEventListener(
    "pointermove",
    (event) => {
      trackPoint(event);
      // Native media controls can consume keyup inside the browser's shadow tree.
      if (
        held &&
        interacting.get() &&
        event.isPrimary &&
        event.pointerType !== "touch" &&
        !event.altKey
      ) {
        held = false;
        if (!event.buttons) pointers.delete(event.pointerId);
        sync();
      }
    },
    capture,
  );
  view.addEventListener("pointerup", pointerEnd, capture);
  view.addEventListener("pointercancel", pointerEnd, capture);
  view.addEventListener("blur", reset, { signal: listeners.signal });
  container.addEventListener(
    "focusout",
    (event) => {
      if (
        event.relatedTarget instanceof Node &&
        !container.contains(event.relatedTarget)
      )
        reset();
    },
    capture,
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) reset();
    },
    { signal: listeners.signal },
  );

  return () => {
    listeners.abort();
    view.clearTimeout(releaseTimer);
    if (interacting.get()) reset();
  };
};
