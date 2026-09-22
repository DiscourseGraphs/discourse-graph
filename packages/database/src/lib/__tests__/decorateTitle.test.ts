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

  it("returns null for a format with placeholders the core title cannot fill", () => {
    expect(
      decorateTitle("[[EVD]] - {content} - {Source}", "REM sleep and recall"),
    ).toBeNull();
  });

  it("returns null for a format without a content placeholder", () => {
    expect(decorateTitle("", "anything")).toBeNull();
    expect(decorateTitle("CLM", "anything")).toBeNull();
  });

  it("keeps a core title that contains the separator or replacement patterns", () => {
    expect(decorateTitle("CLM - {content}", "a - b")).toBe("CLM - a - b");
    expect(decorateTitle("CLM - {content}", "costs $& more")).toBe(
      "CLM - costs $& more",
    );
  });
});
