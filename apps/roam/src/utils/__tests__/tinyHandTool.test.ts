import { describe, expect, it } from "vitest";
import { createTinyHandTool } from "~/components/canvas/tinyHand/TinyHandTool";

describe("TinyHand tool", () => {
  it("uses an available ID when the default ID is taken by a relation", () => {
    const tool = createTinyHandTool([
      "select",
      "dg-tiny-hand",
      "dg-tiny-hand-2",
    ]);

    expect(tool.id).toBe("dg-tiny-hand-3");
  });

  it("does not expose the lock used for drawing tools", () => {
    const tool = createTinyHandTool(["select"]);

    expect(tool.id).toBe("dg-tiny-hand");
    expect(tool.isLockable).toBe(false);
  });
});
