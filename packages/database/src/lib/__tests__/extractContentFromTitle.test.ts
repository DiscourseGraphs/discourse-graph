import { describe, expect, it } from "vitest";
import { extractContentFromTitle } from "../extractContentFromTitle";

describe("extractContentFromTitle", () => {
  it("extracts the content from a title matching the format", () => {
    expect(
      extractContentFromTitle("[[CLM]] - {content}", "[[CLM]] - my claim"),
    ).toBe("my claim");
    expect(extractContentFromTitle("CLM - {content}", "CLM - my claim")).toBe(
      "my claim",
    );
  });

  it("returns the title when the type has no format", () => {
    expect(extractContentFromTitle("", "my claim")).toBe("my claim");
  });

  it("returns the title when it does not match the format", () => {
    expect(extractContentFromTitle("[[CLM]] - {content}", "random page")).toBe(
      "random page",
    );
  });

  it("extracts the content from a format with a {Source} placeholder", () => {
    expect(
      extractContentFromTitle(
        "[[EVD]] - {content} - {Source}",
        "[[EVD]] - finding - @smith2020",
      ),
    ).toBe("finding");
  });

  it("extracts the content when another placeholder comes first", () => {
    expect(
      extractContentFromTitle("{Source}: {content}", "@smith2020: finding"),
    ).toBe("finding");
  });

  it("matches the content placeholder case-insensitively", () => {
    expect(extractContentFromTitle("QUE - {Content}", "QUE - why")).toBe("why");
  });

  it("trims the content", () => {
    expect(extractContentFromTitle("CLM - {content}", "CLM -  my claim ")).toBe(
      "my claim",
    );
  });

  it("returns the title when the format has no content placeholder", () => {
    expect(extractContentFromTitle("QUE - {question}", "QUE - why")).toBe(
      "QUE - why",
    );
  });

  it("preserves an empty content capture instead of falling back to the title", () => {
    expect(
      extractContentFromTitle(
        "[[EVD]] - {content} - {Source}",
        "[[EVD]] -  - @smith2020",
      ),
    ).toBe("");
  });

  it('keeps a trailing content containing " - " whole', () => {
    expect(
      extractContentFromTitle("[[CLM]] - {content}", "[[CLM]] - a - b"),
    ).toBe("a - b");
  });

  it('extracts the shortest match when the content contains " - " before another placeholder (accepted for v0)', () => {
    expect(
      extractContentFromTitle(
        "[[EVD]] - {content} - {Source}",
        "[[EVD]] - a - b - @smith2020",
      ),
    ).toBe("a");
  });

  it("extracts the content from a format with regex metacharacters", () => {
    expect(
      extractContentFromTitle(
        "Claim (draft) - {content}",
        "Claim (draft) - sleep improves memory",
      ),
    ).toBe("sleep improves memory");
    expect(
      extractContentFromTitle("Q*: {content} ($|^)", "Q*: why ($|^)"),
    ).toBe("why");
  });

  it("does not match a title missing the format's literal parentheses", () => {
    expect(
      extractContentFromTitle(
        "Claim (draft) - {content}",
        "Claim draft - sleep",
      ),
    ).toBe("Claim draft - sleep");
  });

  it("skips braces around anything but letters when locating the content", () => {
    expect(extractContentFromTitle("{x1} - {content}", "{x1} - finding")).toBe(
      "finding",
    );
  });

  it("round trips a title built from the core title", () => {
    const coreTitle = "sleep improves memory";
    for (const format of ["[[CLM]] - {content}", "Claim (draft) - {content}"]) {
      expect(
        extractContentFromTitle(format, format.replace("{content}", coreTitle)),
      ).toBe(coreTitle);
    }

    const sourceFormat = "[[EVD]] - {content} - {Source}";
    const title = sourceFormat
      .replace("{content}", coreTitle)
      .replace("{Source}", "@smith2020");
    expect(extractContentFromTitle(sourceFormat, title)).toBe(coreTitle);
  });
});
