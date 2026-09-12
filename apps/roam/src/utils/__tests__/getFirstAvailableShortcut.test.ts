import { describe, expect, it } from "vitest";
import getFirstAvailableShortcut from "~/utils/getFirstAvailableShortcut";

describe("getFirstAvailableShortcut", () => {
  it("assigns the first letter when available", () => {
    expect(getFirstAvailableShortcut("Claim", new Set())).toBe("C");
  });

  it("skips taken letters and assigns the next available one", () => {
    expect(getFirstAvailableShortcut("Claim", new Set(["C"]))).toBe("L");
  });

  it("matches taken shortcuts case-insensitively", () => {
    expect(getFirstAvailableShortcut("claim", new Set(["C", "L"]))).toBe("A");
  });

  it("returns empty when every candidate is taken", () => {
    expect(getFirstAvailableShortcut("Ab", new Set(["A", "B"]))).toBe("");
  });

  it("assigns accented Latin letters", () => {
    expect(getFirstAvailableShortcut("Évidence", new Set())).toBe("É");
    expect(getFirstAvailableShortcut("Évidence", new Set(["É"]))).toBe("V");
  });

  it("assigns Cyrillic letters", () => {
    expect(getFirstAvailableShortcut("Доказательство", new Set())).toBe("Д");
  });

  it("assigns ASCII digits", () => {
    expect(getFirstAvailableShortcut("42 Things", new Set())).toBe("4");
  });

  it("assigns non-ASCII digits", () => {
    expect(getFirstAvailableShortcut("１２３", new Set())).toBe("１");
  });

  it("skips leading punctuation", () => {
    expect(getFirstAvailableShortcut("#Claim", new Set())).toBe("C");
  });

  it("skips separators between words", () => {
    expect(getFirstAvailableShortcut("My Node", new Set(["M", "Y"]))).toBe("N");
  });

  it("never assigns punctuation even when all letters are taken", () => {
    expect(getFirstAvailableShortcut("C++", new Set(["C"]))).toBe("");
  });

  it("returns empty for an empty label", () => {
    expect(getFirstAvailableShortcut("", new Set())).toBe("");
  });
});
