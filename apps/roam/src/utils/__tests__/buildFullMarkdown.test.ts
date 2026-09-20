import { describe, expect, it, vi } from "vitest";
import type { TreeNode } from "roamjs-components/types";

vi.mock("roamjs-components/queries/getFullTreeByParentUid", () => ({
  default: () => ({ children: [] }),
}));
vi.mock("roamjs-components/queries/getPageViewType", () => ({
  default: () => "bullet",
}));
vi.mock("~/utils/pageToMarkdown", () => ({
  toMarkdown: ({ c }: { c: TreeNode }) => `- ${c.text}`,
}));

// Runs before the imports below: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

import { buildFullMarkdown } from "~/utils/roamToCrossAppConverters";

const block = (text: string): TreeNode =>
  ({ text, children: [], order: 0, uid: "" }) as unknown as TreeNode;

describe("buildFullMarkdown", () => {
  it("emits the body without the page title", () => {
    expect(
      buildFullMarkdown({ blocks: [block("first"), block("second")] }),
    ).toBe("- first\n- second\n");
  });

  it("emits an empty string for a page with no blocks", () => {
    expect(buildFullMarkdown({ blocks: [] })).toBe("");
  });

  it("ignores blocks that are empty and childless", () => {
    expect(buildFullMarkdown({ blocks: [block(""), block("kept")] })).toBe(
      "- kept\n",
    );
  });
});
