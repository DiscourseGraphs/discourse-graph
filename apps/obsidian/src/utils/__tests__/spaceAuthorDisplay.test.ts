import { describe, expect, it } from "vitest";
import { authorNamePlacement } from "~/utils/spaceAuthorDisplay";

describe("authorNamePlacement", () => {
  it("names the author of an Obsidian space in the space header", () => {
    expect(authorNamePlacement("Obsidian")).toBe("header");
  });

  it("names the authors of a Roam space on its nodes", () => {
    expect(authorNamePlacement("Roam")).toBe("nodes");
  });

  it("names no one when the platform is unknown", () => {
    expect(authorNamePlacement(undefined)).toBe("none");
  });
});
