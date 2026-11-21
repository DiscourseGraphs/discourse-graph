import { describe, expect, it } from "vitest";
import { nodePathFromRid } from "../../app/utils/conversion/nodeAddress";

describe("public node links", () => {
  it.each([
    ["https://roamresearch.com/#/app/my graph/a&b", "Roam", "my graph", "a&b"],
    ["orn:obsidian.note:demo/abc-123", "Obsidian", "demo", "abc-123"],
  ])("preserves the RID for %s", (rid, platform, spaceKey, localId) => {
    expect(nodePathFromRid(rid)).toEqual({ platform, spaceKey, localId });
  });
  it("rejects unknown platforms", () => {
    expect(nodePathFromRid("https://example.com/space/node")).toBeUndefined();
  });
});
