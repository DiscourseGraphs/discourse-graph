import { beforeEach, describe, expect, it, vi } from "vitest";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";

vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: vi.fn(),
}));
vi.mock("~/utils/importedSourceIdentity", () => ({
  readImportedSourceIdentity: vi.fn(),
}));

// Runs before the imports below: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

import { sourceIdOfNode, titleWithSource } from "~/utils/sourceSlot";

describe("titleWithSource", () => {
  it("fills a missing Source with text that creates no page reference", () => {
    expect(
      titleWithSource({
        format: "[[EVD]] - {content} - {Source}",
        coreTitle: "REM sleep and recall",
        sourceTitle: "(source missing)",
      }),
    ).toBe("[[EVD]] - REM sleep and recall - (source missing)");
  });

  it("fills the content and source placeholders", () => {
    expect(
      titleWithSource({
        format: "[[EVD]] - {content} - {Source}",
        coreTitle: "REM sleep and recall",
        sourceTitle: "@Smith 2020",
      }),
    ).toBe("[[EVD]] - REM sleep and recall - [[@Smith 2020]]");
  });

  it("matches placeholder names regardless of case", () => {
    expect(
      titleWithSource({
        format: "{SOURCE}: {Content}",
        coreTitle: "x",
        sourceTitle: "y",
      }),
    ).toBe("[[y]]: x");
  });

  it("inserts titles that contain replacement patterns verbatim", () => {
    expect(
      titleWithSource({
        format: "[[EVD]] - {content} - {Source}",
        coreTitle: "costs $& more",
        sourceTitle: "$1 paper",
      }),
    ).toBe("[[EVD]] - costs $& more - [[$1 paper]]");
  });

  it("returns null when the format has a placeholder it cannot fill", () => {
    expect(
      titleWithSource({
        format: "[[EVD]] - {content} - {Source} - {Author}",
        coreTitle: "x",
        sourceTitle: "y",
      }),
    ).toBeNull();
  });

  it("returns null when the format has no content placeholder", () => {
    expect(
      titleWithSource({
        format: "[[EVD]] - {Source}",
        coreTitle: "x",
        sourceTitle: "y",
      }),
    ).toBeNull();
  });
});

describe("sourceIdOfNode", () => {
  const schema = { format: "[[EVD]] - {content} - {Source}" };
  const sourceNode: DiscourseNode = {
    type: "source-type",
    text: "Source",
    shortcut: "S",
    format: "@{content}",
    specification: [],
    backedBy: "user",
    canvasSettings: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPageUidByPageTitle).mockReturnValue("source-page");
  });

  it.each(["(source missing)", "[[(source missing)]]"])(
    "omits %s even if a custom node format and an existing page match it",
    (sourceField) => {
      const customSource = { ...sourceNode, format: "{Content}" };
      expect("(source missing)").toMatch(
        getDiscourseNodeFormatExpression(customSource.format),
      );
      expect(
        sourceIdOfNode(`[[EVD]] - X - ${sourceField}`, schema, [customSource]),
      ).toBeUndefined();
      expect(getPageUidByPageTitle).not.toHaveBeenCalled();
    },
  );

  it("still resolves a real Source page reference", () => {
    expect(
      sourceIdOfNode("[[EVD]] - X - [[@Smith 2020]]", schema, [sourceNode]),
    ).toBe("source-page");
  });
});
