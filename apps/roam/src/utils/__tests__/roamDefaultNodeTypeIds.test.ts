import { describe, expect, it } from "vitest";
import { ROAM_DEFAULT_NODE_TYPE_IDS } from "@repo/database/lib/tripleMatching";
import INITIAL_NODE_VALUES from "~/data/defaultDiscourseNodes";

describe("ROAM_DEFAULT_NODE_TYPE_IDS", () => {
  it("lists exactly the ids of Roam's default node types", () => {
    expect(new Set(ROAM_DEFAULT_NODE_TYPE_IDS)).toEqual(
      new Set(INITIAL_NODE_VALUES.map(({ type }) => type)),
    );
  });
});
