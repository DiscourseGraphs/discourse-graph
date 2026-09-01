import { useEffect } from "react";
import {
  SETTING_ANCHOR_FLASH_CLASS,
  settingAnchorSelector,
} from "../utils/settingAnchor";

/** Roughly 500ms at 60fps. */
const MAX_LOOKUP_FRAMES = 30;
const FLASH_DURATION_MS = 1600;

const flashTimeouts = new WeakMap<Element, number>();

/**
 * Marks the row that was jumped to, and owns the class for the whole animation.
 *
 * Deliberately not scoped to the effect below: finding the row settles the jump,
 * which clears `anchorId` and so re-runs the effect. An effect-scoped cleanup
 * would strip the class on that very next render, and the flash would never be
 * seen.
 */
const flashRow = (target: Element): void => {
  const pending = flashTimeouts.get(target);
  if (pending !== undefined) window.clearTimeout(pending);

  // Removing and forcing a reflow restarts the animation, so jumping to the same
  // row twice flashes twice rather than riding the first animation out.
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
    // Only the lookup is cancellable; the flash owns its own lifetime.
    return () => cancelAnimationFrame(rafId);
  }, [anchorId, onSettled]);
};
