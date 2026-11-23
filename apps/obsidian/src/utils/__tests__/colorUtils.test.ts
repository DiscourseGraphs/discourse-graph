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

const pleasing = (hex: string) => {
  const { background, text } = getPleasingColors(colord(hex));
  return { baseColor: hex, backgroundColor: background, textColor: text };
};

describe("getNodeTagColors", () => {
  it("derives tag colors from a custom color with Roam's algorithm", () => {
    expect(getNodeTagColors(nodeType("#e03131"), 0)).toEqual(
      pleasing("#e03131"),
    );
  });

  it("uses the palette color at the node's index when no color is set", () => {
    // Index 1 is blue (#4263eb), the same default Roam picks.
    expect(getNodeTagColors(nodeType(), 1)).toEqual(pleasing("#4263eb"));
  });

  it("falls back to the first palette color for an out-of-range index", () => {
    expect(getNodeTagColors(nodeType(), 99)).toEqual(pleasing("#1d1d1d"));
    expect(getNodeTagColors(nodeType(), -1)).toEqual(pleasing("#1d1d1d"));
  });

  it("gives a light background with dark, AA-contrast text", () => {
    const { backgroundColor, textColor } = getNodeTagColors(nodeType(), 1);
    expect(colord(backgroundColor).isLight()).toBe(true);
    expect(colord(textColor).isDark()).toBe(true);
    expect(colord(backgroundColor).contrast(textColor)).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
