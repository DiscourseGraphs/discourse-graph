// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

// The module reads roamAlphaAPI at import; the color logic doesn't use it.
vi.hoisted(() => {
  const stub = (): unknown =>
    new Proxy(() => stub(), { get: () => stub(), apply: () => stub() });
  Object.assign(window, { roamAlphaAPI: stub() });
});
import { getRelationColor } from "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil";

describe("getRelationColor", () => {
  it("keeps named relation colors, ignoring case", () => {
    expect(getRelationColor("Supports")).toBe("green");
    expect(getRelationColor("supported by")).toBe("green");
    expect(getRelationColor("OPPOSES")).toBe("red");
    expect(getRelationColor("informed by")).toBe("grey");
  });

  it("falls back to grey, readable on light and dark canvases, when drawing without an index", () => {
    expect(getRelationColor("eng2244 custom")).toBe("grey");
    expect(getRelationColor("constructor")).toBe("grey");
    expect(getRelationColor("removed relation", -1)).toBe("grey");
  });

  it("keeps named colors out of the indexed palette and wraps past it", () => {
    const colors = Array.from({ length: 20 }, (_, i) =>
      getRelationColor("custom", i),
    );
    expect(colors).not.toContain("red");
    expect(colors).not.toContain("green");
    expect(colors).not.toContain("grey");
    expect(colors).not.toContain(undefined);
    expect(getRelationColor("custom", 0)).toBe("white");
    expect(getRelationColor("custom", 0)).toBe(getRelationColor("custom", 10));
  });
});
