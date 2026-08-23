import { describe, expect, it } from "vitest";
import { decorateTitle } from "../decorateTitle";

describe("decorateTitle", () => {
  it("substitutes the core title for {content}", () => {
    expect(decorateTitle("[[CLM]] - {content}", "sleep improves memory")).toBe(
      "[[CLM]] - sleep improves memory",
    );
    expect(decorateTitle("CLM - {content}", "sleep improves memory")).toBe(
      "CLM - sleep improves memory",
    );
  });

  it("matches the content placeholder case-insensitively", () => {
    expect(decorateTitle("QUE - {Content}", "why")).toBe("QUE - why");
  });

  it("substitutes the empty string for other placeholders", () => {
    expect(
      decorateTitle("[[EVD]] - {content} - {Source}", "REM sleep and recall"),
    ).toBe("[[EVD]] - REM sleep and recall - ");
  });

  it("returns the empty string for an empty format", () => {
    expect(decorateTitle("", "anything")).toBe("");
  });

  it("keeps a core title that contains the separator", () => {
    expect(decorateTitle("CLM - {content}", "a - b")).toBe("CLM - a - b");
  });
});
