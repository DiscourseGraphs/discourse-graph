import { describe, it, expect } from "vitest";
import {
  getGraphColors,
  hexToRgbChannels,
  readColorToken,
} from "../../app/utils/brandColors";

describe("hexToRgbChannels", () => {
  it("converts a 6-digit hex color to comma-separated channels", () => {
    expect(hexToRgbChannels("#FF8C4B")).toBe("255, 140, 75");
    expect(hexToRgbChannels("#1f1f1f")).toBe("31, 31, 31");
  });

  it("rejects anything that is not a 6-digit hex color", () => {
    expect(() => hexToRgbChannels("#fff")).toThrow();
    expect(() => hexToRgbChannels("rgb(1, 2, 3)")).toThrow();
  });
});

describe("readColorToken", () => {
  const colors = { primary: { DEFAULT: "#000000", rgb: "1, 2, 3" } };

  it("reads a nested string token", () => {
    expect(readColorToken({ colors, path: ["primary", "rgb"] })).toBe(
      "1, 2, 3",
    );
  });

  it("throws with the token path when it is missing or not a string", () => {
    expect(() =>
      readColorToken({ colors, path: ["secondary", "rgb"] }),
    ).toThrow("secondary.rgb");
    expect(() => readColorToken({ colors, path: ["primary"] })).toThrow(
      "primary",
    );
    expect(() => readColorToken({ colors: undefined, path: ["a"] })).toThrow();
  });

  it("throws instead of returning a string found partway down the path", () => {
    expect(() =>
      readColorToken({
        colors: { primary: "#FF8C4B" },
        path: ["primary", "rgb"],
      }),
    ).toThrow("primary.rgb");
  });
});

describe("getGraphColors", () => {
  it("derives the pulse and edge colors from the shared Tailwind config", () => {
    expect(getGraphColors()).toEqual({
      pulse: "255, 140, 75",
      edge: "31, 31, 31",
    });
  });
});
