import { describe, expect, it } from "vitest";
import { clampMenuCentre } from "~/components/canvas/utils/menuPlacement";

const menu = { width: 160, height: 128 };
const viewport = { width: 1000, height: 800 };
const place = (x: number, y: number, flyoutWidth = 0) =>
  clampMenuCentre({
    anchor: { x, y },
    menu,
    flyoutWidth,
    viewport,
    margin: 8,
  });

describe("clampMenuCentre", () => {
  it("keeps the anchor when the menu fits", () => {
    expect(place(500, 400)).toEqual({ x: 500, y: 400 });
  });

  it("moves the menu inside the top and left edges", () => {
    expect(place(10, 10)).toEqual({ x: 88, y: 72 });
  });

  it("moves the menu inside the bottom and right edges", () => {
    expect(place(995, 795)).toEqual({ x: 912, y: 728 });
  });

  it("leaves room for an open flyout on the right", () => {
    expect(place(900, 400, 132)).toEqual({ x: 780, y: 400 });
  });

  it("keeps the left edge visible when the menu is wider than the viewport", () => {
    const narrow = clampMenuCentre({
      anchor: { x: 50, y: 400 },
      menu,
      flyoutWidth: 132,
      viewport: { width: 300, height: 800 },
      margin: 8,
    });
    expect(narrow.x).toBe(88);
  });
});
