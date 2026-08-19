import { describe, expect, it } from "vitest";
import extractContentFromTitle from "~/utils/extractContentFromTitle";

describe("extractContentFromTitle", () => {
  it("extracts the content from a title matching the format", () => {
    expect(
      extractContentFromTitle("[[CLM]] - my claim", {
        format: "[[CLM]] - {content}",
      }),
    ).toBe("my claim");
  });

  it("returns the title when the type has no format", () => {
    expect(extractContentFromTitle("my claim", { format: "" })).toBe(
      "my claim",
    );
  });

  it("returns the title when it does not match the format", () => {
    expect(
      extractContentFromTitle("random page", {
        format: "[[CLM]] - {content}",
      }),
    ).toBe("random page");
  });

  it("extracts the content from a format with a {Source} placeholder", () => {
    expect(
      extractContentFromTitle("[[EVD]] - finding - @smith2020", {
        format: "[[EVD]] - {content} - {Source}",
      }),
    ).toBe("finding");
  });

  it('keeps a trailing content containing " - " whole', () => {
    expect(
      extractContentFromTitle("[[CLM]] - a - b", {
        format: "[[CLM]] - {content}",
      }),
    ).toBe("a - b");
  });

  it('extracts the shortest match when the content contains " - " before another placeholder (accepted for v0)', () => {
    expect(
      extractContentFromTitle("[[EVD]] - a - b - @smith2020", {
        format: "[[EVD]] - {content} - {Source}",
      }),
    ).toBe("a");
  });

  it("round trips a title built from the core title", () => {
    const coreTitle = "sleep improves memory";
    const simpleFormat = "[[CLM]] - {content}";
    expect(
      extractContentFromTitle(simpleFormat.replace("{content}", coreTitle), {
        format: simpleFormat,
      }),
    ).toBe(coreTitle);

    const sourceFormat = "[[EVD]] - {content} - {Source}";
    const title = sourceFormat
      .replace("{content}", coreTitle)
      .replace("{Source}", "@smith2020");
    expect(extractContentFromTitle(title, { format: sourceFormat })).toBe(
      coreTitle,
    );
  });
});
