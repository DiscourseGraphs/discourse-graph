import { describe, expect, it, vi } from "vitest";

// Runs before the imports below: getDiscourseNodes calls generateUID at module load.
vi.hoisted(() => {
  (globalThis as { window?: unknown }).window = {
    roamAlphaAPI: { util: { generateUID: () => "someUid" } },
  };
});

import { titleWithSource } from "~/utils/sourceSlot";

describe("titleWithSource", () => {
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
