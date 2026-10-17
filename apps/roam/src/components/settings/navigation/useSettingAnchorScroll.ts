import { useEffect } from "react";
import { Classes } from "@blueprintjs/core";
import { settingAnchorSelector } from "~/components/settings/utils/settingAnchor";

/** Time-based so it outlasts Blueprint's 200ms Collapse timer on high-refresh displays. */
const LOOKUP_TIMEOUT_MS = 500;
const FLASH_HOLD_MS = 600;
const FLASH_FADE_MS = 700;

/** `-mx-2 px-2` widens the highlight past the row's content without moving it. */
const FLASH_FRAME_CLASSES = [
  "-mx-2",
  "px-2",
  "rounded",
  "transition-colors",
  "duration-700",
];
const FLASH_FILL_CLASS = "bg-gray-100";

const flashTimeouts = new WeakMap<Element, number[]>();

/** Owns the flash independently of the effect: settling clears anchorId and re-runs the
 *  effect, whose cleanup would otherwise strip the classes before they are seen. */
const flashRow = (target: Element): void => {
  flashTimeouts.get(target)?.forEach((id) => window.clearTimeout(id));

  target.classList.add(...FLASH_FRAME_CLASSES, FLASH_FILL_CLASS);
  flashTimeouts.set(target, [
    // Dropping the fill while the transition class is still on fades it out.
    window.setTimeout(
      () => target.classList.remove(FLASH_FILL_CLASS),
      FLASH_HOLD_MS,
    ),
    window.setTimeout(() => {
      target.classList.remove(...FLASH_FRAME_CLASSES);
      flashTimeouts.delete(target);
    }, FLASH_HOLD_MS + FLASH_FADE_MS),
  ]);
};

/** Blueprint sets an open `Collapse` to `height: auto` only after its animation ends;
 *  scrolling earlier lands short of the row. */
const isFullyExpanded = (target: Element): boolean => {
  for (let el = target.parentElement; el; el = el.parentElement) {
    if (el.classList.contains(Classes.COLLAPSE) && el.style.height !== "auto")
      return false;
  }
  return true;
};

/** The row is not in the DOM when the jump is dispatched — only the active panel renders,
 *  and a `Collapse` mounts later still — so a single lookup misses and this retries. */
export const useSettingAnchorScroll = ({
  anchorId,
  onSettled,
}: {
  anchorId: string | null;
  onSettled: () => void;
}): void => {
  useEffect(() => {
    if (!anchorId) return;
    const deadline = performance.now() + LOOKUP_TIMEOUT_MS;
    let rafId = 0;

    const reveal = (target: Element): void => {
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      flashRow(target);
      onSettled();
    };

    const look = () => {
      const target = document.querySelector(settingAnchorSelector(anchorId));
      if (target && isFullyExpanded(target)) return reveal(target);
      if (performance.now() >= deadline) {
        if (target) reveal(target);
        else onSettled();
        return;
      }
      rafId = requestAnimationFrame(look);
    };

    rafId = requestAnimationFrame(look);
    return () => cancelAnimationFrame(rafId);
  }, [anchorId, onSettled]);
};
