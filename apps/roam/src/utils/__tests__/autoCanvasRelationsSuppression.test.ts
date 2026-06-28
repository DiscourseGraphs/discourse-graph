import { describe, expect, it } from "vitest";
import {
  areAutoCanvasRelationsSuppressed,
  shouldCreateAutoCanvasRelations,
  withAutoCanvasRelationsSuppressed,
} from "~/components/canvas/autoCanvasRelationsSuppression";

describe("auto canvas relation suppression", () => {
  it("suppresses auto canvas relations only inside the callback", () => {
    expect(areAutoCanvasRelationsSuppressed()).toBe(false);

    const value = withAutoCanvasRelationsSuppressed(() => {
      expect(areAutoCanvasRelationsSuppressed()).toBe(true);
      return "loaded";
    });

    expect(value).toBe("loaded");
    expect(areAutoCanvasRelationsSuppressed()).toBe(false);
  });

  it("keeps suppression active for nested callbacks", () => {
    withAutoCanvasRelationsSuppressed(() => {
      expect(areAutoCanvasRelationsSuppressed()).toBe(true);

      withAutoCanvasRelationsSuppressed(() => {
        expect(areAutoCanvasRelationsSuppressed()).toBe(true);
      });

      expect(areAutoCanvasRelationsSuppressed()).toBe(true);
    });

    expect(areAutoCanvasRelationsSuppressed()).toBe(false);
  });

  it("restores suppression state when the callback throws", () => {
    expect(() =>
      withAutoCanvasRelationsSuppressed(() => {
        throw new Error("load failed");
      }),
    ).toThrow("load failed");

    expect(areAutoCanvasRelationsSuppressed()).toBe(false);
  });

  it("allows auto canvas relations for user-created records", () => {
    expect(shouldCreateAutoCanvasRelations({ source: "user" })).toBe(true);
  });

  it("skips auto canvas relations for remote-created records", () => {
    expect(shouldCreateAutoCanvasRelations({ source: "remote" })).toBe(false);
  });

  it("skips user-created records while suppression is active", () => {
    withAutoCanvasRelationsSuppressed(() => {
      expect(shouldCreateAutoCanvasRelations({ source: "user" })).toBe(false);
    });
  });
});
