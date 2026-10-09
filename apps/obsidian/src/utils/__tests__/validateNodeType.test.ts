import { describe, expect, it } from "vitest";
import { decorateTitle } from "@repo/database/lib/decorateTitle";
import type { DiscourseNode } from "~/types";
import {
  checkInvalidChars,
  normalizeImportedNodeFormat,
  validateNodeFormat,
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

describe("validateNodeFormat", () => {
  const currentNode: DiscourseNode = {
    id: "node-1",
    name: "Evidence",
    format: "",
    created: 0,
    modified: 0,
  };
  const validate = (format: string): ReturnType<typeof validateNodeFormat> =>
    validateNodeFormat({ format, currentNode, allNodes: [currentNode] });

  it.each([
    [
      "EVD - {content} - {Source}",
      "Format contains unsupported placeholder: {Source}. Only {content} is supported.",
    ],
    [
      "{Author}: {content}",
      "Format contains unsupported placeholder: {Author}. Only {content} is supported.",
    ],
    [
      "{Source} - {content} - {Author} - {Source}",
      "Format contains unsupported placeholders: {Source}, {Author}. Only {content} is supported.",
    ],
  ])("rejects the unsupported placeholders in %s", (format, error) => {
    expect(validate(format)).toEqual({ isValid: false, error });
  });

  it.each(["CLM - {content}", "{content}", "@{content}"])(
    "accepts the content-only format %s",
    (format) => {
      expect(validate(format)).toEqual({ isValid: true });
    },
  );

  it.each(["CLM - title", "EVD - {Source}"])(
    "reports the missing {content} for %s",
    (format) => {
      expect(validate(format)).toEqual({
        isValid: false,
        error: 'Format must include the placeholder "{content}"',
      });
    },
  );
});
