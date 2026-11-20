import { describe, expect, it, vi } from "vitest";
import type { TreeNode, ViewType } from "roamjs-components/types";

vi.mock("roamjs-components/queries/getFullTreeByParentUid", () => ({
  default: () => ({ children: [] }),
}));

// Runs before the imports below: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

import { toMarkdown } from "~/utils/pageToMarkdown";

const block = (text: string, children: TreeNode[] = []): TreeNode =>
  ({ text, children, order: 0, uid: "" }) as unknown as TreeNode;

const opts = {
  refs: false,
  embeds: false,
  simplifiedFilename: false,
  maxFilenameLength: 64,
  allNodes: [],
  removeSpecialCharacters: false,
  linkType: "wikilinks",
};

const render = ({
  c,
  v,
  flatten,
}: {
  c: TreeNode;
  v?: ViewType;
  flatten?: boolean;
}): string => toMarkdown({ c, v, opts: { ...opts, flatten } });

const codeBlock = "```js\nconst a = 1;\n\nconst b = 2;\n```";

describe("toMarkdown multi-line blocks", () => {
  it("indents every line of a top-level bullet to its content column", () => {
    expect(render({ c: block(`intro\n${codeBlock}`) })).toBe(
      "- intro\n  ```js\n  const a = 1;\n\n  const b = 2;\n  ```",
    );
  });

  it("indents every line of a nested bullet to its content column", () => {
    expect(render({ c: block("parent", [block(`intro\n${codeBlock}`)]) })).toBe(
      "- parent\n    - intro\n      ```js\n      const a = 1;\n\n      const b = 2;\n      ```",
    );
  });

  it("indents to the wider content column of a numbered item", () => {
    expect(render({ c: block("first\nsecond"), v: "numbered" })).toBe(
      "1. first\n   second",
    );
  });

  it("leaves continuation lines alone when flattening", () => {
    expect(
      render({ c: block("parent", [block("first\nsecond")]), flatten: true }),
    ).toBe("- parent\n- first\nsecond");
  });

  it("leaves continuation lines alone in the document view type", () => {
    expect(
      render({ c: block("parent", [block("first\nsecond")]), v: "document" }),
    ).toBe("parent\n\n    first\nsecond\n");
  });
});
