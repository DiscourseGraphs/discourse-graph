import { useEffect } from "react";
import {
  SETTING_ANCHOR_FLASH_CLASS,
  settingAnchorSelector,
} from "../utils/settingAnchor";

/** Roughly 500ms at 60fps. */
const MAX_LOOKUP_FRAMES = 30;
const FLASH_DURATION_MS = 1600;

const flashTimeouts = new WeakMap<Element, number>();

/** Owns the flash independently of the effect: settling clears anchorId and re-runs the
 *  effect, whose cleanup would otherwise strip the class before it is seen. */
const flashRow = (target: Element): void => {
  const pending = flashTimeouts.get(target);
  if (pending !== undefined) window.clearTimeout(pending);

  // Remove and reflow so hitting the same row twice restarts the animation.
  target.classList.remove(SETTING_ANCHOR_FLASH_CLASS);
  target.getBoundingClientRect();
  target.classList.add(SETTING_ANCHOR_FLASH_CLASS);

  flashTimeouts.set(
    target,
    window.setTimeout(() => {
      target.classList.remove(SETTING_ANCHOR_FLASH_CLASS);
      flashTimeouts.delete(target);
    }, FLASH_DURATION_MS),
  );
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
    let frame = 0;
    let rafId = 0;

    const look = () => {
      const target = document.querySelector(settingAnchorSelector(anchorId));
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        flashRow(target);
        onSettled();
        return;
      }
      if (frame++ >= MAX_LOOKUP_FRAMES) {
        onSettled();
        return;
      }
      rafId = requestAnimationFrame(look);
    };

    rafId = requestAnimationFrame(look);
    return () => cancelAnimationFrame(rafId);
  }, [anchorId, onSettled]);
};
