import { describe, expect, it } from "vitest";
import { nodePathFromRid } from "../../app/utils/conversion/nodeAddress";

describe("public node links", () => {
  it.each([
    [
      "https://roamresearch.com/#/app/my graph/a&b",
      { platform: "Roam", spaceKey: "my graph", localId: "a&b" },
    ],
    [
      "orn:obsidian.note:demo/abc-123",
      { platform: "Obsidian", spaceKey: "demo", localId: "abc-123" },
    ],
  ] as const)("preserves the RID for %s", (rid, expected) => {
    expect(nodePathFromRid(rid)).toEqual(expected);
  });
  it("rejects unknown platforms", () => {
    expect(nodePathFromRid("https://example.com/space/node")).toBeUndefined();
  });
});
