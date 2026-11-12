import type { Placement } from "./tourSteps";

export type Rect = { top: number; left: number; width: number; height: number };
type Size = { width: number; height: number };

export const SPOTLIGHT_PADDING = 6;
const GAP = 12;
const VIEWPORT_MARGIN = 8;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Places the card beside the spotlight, then keeps it fully inside the viewport. */
export const getCardPosition = ({
  target,
  placement,
  card,
  viewport,
}: {
  target: Rect;
  placement: Placement;
  card: Size;
  viewport: Size;
}): { top: number; left: number } => {
  const offset = SPOTLIGHT_PADDING + GAP;
  const unclamped = {
    right: { top: target.top, left: target.left + target.width + offset },
    left: { top: target.top, left: target.left - offset - card.width },
    bottom: { top: target.top + target.height + offset, left: target.left },
    top: { top: target.top - offset - card.height, left: target.left },
  }[placement];
  return {
    top: clamp(
      unclamped.top,
      VIEWPORT_MARGIN,
      viewport.height - card.height - VIEWPORT_MARGIN,
    ),
    left: clamp(
      unclamped.left,
      VIEWPORT_MARGIN,
      viewport.width - card.width - VIEWPORT_MARGIN,
    ),
  };
};
