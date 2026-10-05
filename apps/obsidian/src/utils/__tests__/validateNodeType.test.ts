import { describe, expect, it } from "vitest";
import { decorateTitle } from "@repo/database/lib/decorateTitle";
import {
  checkInvalidChars,
  normalizeImportedNodeFormat,
} from "~/utils/validateNodeType";

describe("normalizeImportedNodeFormat", () => {
  it("removes the page reference brackets from a Roam format", () => {
    expect(normalizeImportedNodeFormat("[[CLM]] - {content}")).toBe(
      "CLM - {content}",
    );
  });

  it("decorates an imported title from the normalized Roam format", () => {
    expect(
      decorateTitle(
        normalizeImportedNodeFormat("[[CLM]] - {content}"),
        "sleep improves memory",
      ),
    ).toBe("CLM - sleep improves memory");
  });

  it.each([
    ["#CLM - {content}", "CLM - {content}"],
    ["CLM^ - {content}", "CLM - {content}"],
    ["[CLM] - {content}", "CLM - {content}"],
    ["CLM | {content}", "CLM {content}"],
    ["#[[CLM]] - [[{content}]]", "CLM - {content}"],
  ])(
    "removes invalid filename characters from %s so it passes the invalid character check",
    (format, expected) => {
      const normalized = normalizeImportedNodeFormat(format);
      expect(normalized).toBe(expected);
      expect(checkInvalidChars(normalized).isValid).toBe(true);
    },
  );

  it("returns an empty format when the format has only invalid characters and spaces", () => {
    expect(normalizeImportedNodeFormat("[[ ]]")).toBe("");
  });

  it("removes the [ that a type name such as [Draft] carries into its default format", () => {
    expect(normalizeImportedNodeFormat("[DR - {content}")).toBe(
      "DR - {content}",
    );
  });

  it.each([
    "CLM - {content}",
    "@{content}",
    "EVD - {content} - {Source}",
    "CLM  -  {content}",
  ])("leaves the valid format %s unchanged", (format) => {
    expect(normalizeImportedNodeFormat(format)).toBe(format);
  });
});
