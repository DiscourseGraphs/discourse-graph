import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A lost `}` does not fail the build: with CSS nesting, every rule after it
// silently becomes a descendant rule of the one left open and stops matching.
// That happened once to the scroll container of the settings drill-down, so the
// stylesheet's shape is pinned here.
const css = readFileSync(
  resolve(__dirname, "../../styles/settingsStyles.css"),
  "utf8",
);

const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "");

const topLevelSelectors = (s: string): string[] => {
  const selectors: string[] = [];
  let depth = 0;
  let buf = "";
  for (const ch of stripComments(s)) {
    if (ch === "{") {
      if (depth === 0) selectors.push(buf.trim());
      depth += 1;
      buf = "";
    } else if (ch === "}") {
      depth -= 1;
      buf = "";
    } else if (depth === 0) {
      buf += ch;
    }
  }
  expect(depth).toBe(0);
  return selectors;
};

describe("settingsStyles.css", () => {
  it("closes every rule it opens", () => {
    const body = stripComments(css);
    expect(body.split("{").length).toBe(body.split("}").length);
  });

  it("keeps the layout rules the settings dialog depends on at top level", () => {
    const selectors = topLevelSelectors(css);
    for (const required of [
      ":root",
      ".dg-settings-route",
      ".dg-settings-route__body",
      ".dg-settings-heading",
      ".dg-settings-group",
    ]) {
      expect(selectors).toContain(required);
    }
  });
});
