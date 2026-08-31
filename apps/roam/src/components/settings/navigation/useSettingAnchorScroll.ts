import { useEffect } from "react";
import {
  SETTING_ANCHOR_FLASH_CLASS,
  settingAnchorSelector,
} from "../utils/settingAnchor";

/** Roughly 500ms at 60fps. */
const MAX_LOOKUP_FRAMES = 30;
const FLASH_DURATION_MS = 1600;

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
    let flashTimeout: ReturnType<typeof setTimeout> | undefined;
    let flashed: Element | null = null;

    const settle = () => {
      onSettled();
    };

    const look = () => {
      const target = document.querySelector(settingAnchorSelector(anchorId));
      if (target) {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
        target.classList.add(SETTING_ANCHOR_FLASH_CLASS);
        flashed = target;
        flashTimeout = setTimeout(() => {
          target.classList.remove(SETTING_ANCHOR_FLASH_CLASS);
        }, FLASH_DURATION_MS);
        settle();
        return;
      }
      if (frame++ >= MAX_LOOKUP_FRAMES) {
        settle();
        return;
      }
      rafId = requestAnimationFrame(look);
    };

    rafId = requestAnimationFrame(look);
    return () => {
      cancelAnimationFrame(rafId);
      if (flashTimeout) clearTimeout(flashTimeout);
      flashed?.classList.remove(SETTING_ANCHOR_FLASH_CLASS);
    };
  }, [anchorId, onSettled]);
};
