import { describe, expect, it } from "vitest";
import {
  getCardPosition,
  SPOTLIGHT_PADDING,
} from "~/components/tutorial/cardPosition";

const viewport = { width: 1200, height: 800 };
const card = { width: 300, height: 150 };
const target = { top: 100, left: 40, width: 30, height: 30 };
const offset = SPOTLIGHT_PADDING + 12;

describe("getCardPosition", () => {
  it("places the card beside the target for each placement", () => {
    expect(
      getCardPosition({ target, placement: "right", card, viewport }),
    ).toEqual({ top: 100, left: 40 + 30 + offset });
    expect(
      getCardPosition({ target, placement: "bottom", card, viewport }),
    ).toEqual({ top: 100 + 30 + offset, left: 40 });
  });

  it("keeps a card that would overflow the left edge on screen", () => {
    // The ribbon sits at the far left, so "left" placement would go off screen.
    expect(
      getCardPosition({ target, placement: "left", card, viewport }).left,
    ).toBe(8);
  });

  it("keeps a card below a target near the bottom inside the viewport", () => {
    const lowTarget = { top: 760, left: 600, width: 200, height: 30 };
    expect(
      getCardPosition({
        target: lowTarget,
        placement: "bottom",
        card,
        viewport,
      }).top,
    ).toBe(800 - 150 - 8);
  });

  it("pins to the margin when the card is larger than the viewport", () => {
    const tiny = { width: 200, height: 100 };
    expect(
      getCardPosition({ target, placement: "right", card, viewport: tiny }),
    ).toEqual({ top: 8, left: 8 });
  });
});
