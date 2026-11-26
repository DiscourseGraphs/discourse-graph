import { colord } from "colord";
import { describe, expect, it } from "vitest";
import getPleasingColors from "@repo/utils/getPleasingColors";
import type { DiscourseNode } from "~/types";
import { getNodeTagColors } from "~/utils/colorUtils";

const nodeType = (color?: string): DiscourseNode => ({
  id: "claim",
  name: "Claim",
  format: "CLM - {content}",
  color,
  created: 0,
  modified: 0,
});

const pleasing = (
  hex: string,
): { baseColor: string; backgroundColor: string; textColor: string } => {
  const { background, text } = getPleasingColors(colord(hex));
  return { baseColor: hex, backgroundColor: background, textColor: text };
};

describe("getNodeTagColors", () => {
  it("derives tag colors from a custom color with Roam's algorithm", () => {
    expect(getNodeTagColors(nodeType("#e03131"), 0)).toEqual(
      pleasing("#e03131"),
    );
  });

  it("uses Roam's default palette order when no color is set", () => {
    // Roam's COLOR_ARRAY is tldraw's defaultColorNames reversed: white, red, ..., black.
    expect(getNodeTagColors(nodeType(), 0)).toEqual(pleasing("#ffffff"));
    expect(getNodeTagColors(nodeType(), 1)).toEqual(pleasing("#e03131"));
    expect(getNodeTagColors(nodeType(), 12)).toEqual(pleasing("#1d1d1d"));
  });

  it("falls back to the first palette color for an out-of-range index", () => {
    expect(getNodeTagColors(nodeType(), 99)).toEqual(pleasing("#ffffff"));
    expect(getNodeTagColors(nodeType(), -1)).toEqual(pleasing("#ffffff"));
  });

  it("returns the same colors on repeated calls", () => {
    const first = getNodeTagColors(nodeType("#7DA13E"), 0);
    expect(getNodeTagColors(nodeType("#7DA13E"), 3)).toEqual(first);
  });

  it("gives a light background with dark, AA-contrast text", () => {
    const { backgroundColor, textColor } = getNodeTagColors(
      nodeType("#4263eb"),
      0,
    );
    expect(colord(backgroundColor).isLight()).toBe(true);
    expect(colord(textColor).isDark()).toBe(true);
    expect(colord(backgroundColor).contrast(textColor)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
