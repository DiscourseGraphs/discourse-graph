import { describe, expect, it } from "vitest";
import {
  getDiscourseNodeFormatExpression,
  getDiscourseNodeFormatInnerExpression,
} from "../getDiscourseNodeFormatExpression";

describe("getDiscourseNodeFormatExpression", () => {
  it.each([
    ["[[CLM]] - {content}", "^\\[\\[CLM\\]\\] - (.*?)$"],
    ["[[EVD]] - {content} - {Source}", "^\\[\\[EVD\\]\\] - (.*?) - (.*?)$"],
    ["@{content}", "^@(.*?)$"],
    ["CLM - {content}", "^CLM - (.*?)$"],
    ["{content}", "^(.*?)$"],
    ["What? {content}.", "^What\\? (.*?)\\.$"],
    ["a+b {content}", "^a\\+b (.*?)$"],
    ["{x1} - {content}", "^\\{x1\\} - (.*?)$"],
  ])("builds %s into /%s/", (format, source) => {
    expect(getDiscourseNodeFormatExpression(format).source).toBe(source);
  });

  it("matches a literal parenthesized group instead of capturing it", () => {
    const expression = getDiscourseNodeFormatExpression(
      "Claim (draft) - {content}",
    );
    expect(expression.exec("Claim (draft) - sleep")?.slice(1)).toEqual([
      "sleep",
    ]);
    expect(expression.test("Claim draft - sleep")).toBe(false);
  });

  it.each(["(", ")", "*", "^", "$", "|", ".", "+", "?", "[", "]", "{", "}"])(
    "matches %s in a literal segment only as itself",
    (character) => {
      const expression = getDiscourseNodeFormatExpression(
        `A${character}B - {content}`,
      );
      expect(expression.exec(`A${character}B - x`)?.slice(1)).toEqual(["x"]);
      expect(expression.test("AB - x")).toBe(false);
      expect(expression.test("AzB - x")).toBe(false);
    },
  );

  it("matches a backslash in a literal segment only as itself", () => {
    const expression = getDiscourseNodeFormatExpression("A\\d - {content}");
    expect(expression.exec("A\\d - x")?.slice(1)).toEqual(["x"]);
    expect(expression.test("A1 - x")).toBe(false);
  });

  it("captures every placeholder in order", () => {
    expect(
      getDiscourseNodeFormatExpression("(EVD) {content} | {Source}")
        .exec("(EVD) finding | [[@smith2020]]")
        ?.slice(1),
    ).toEqual(["finding", "[[@smith2020]]"]);
  });

  it("treats braces around anything but letters as literal text", () => {
    expect(
      getDiscourseNodeFormatExpression("{x1} - {content}")
        .exec("{x1} - finding")
        ?.slice(1),
    ).toEqual(["finding"]);
  });

  it("matches no title for an empty format", () => {
    expect(getDiscourseNodeFormatExpression("").test("CLM - claim")).toBe(
      false,
    );
  });
});

describe("getDiscourseNodeFormatInnerExpression", () => {
  it("escapes the literal segments without anchoring the expression", () => {
    expect(getDiscourseNodeFormatInnerExpression("a|b - {content}")).toBe(
      "a\\|b - (.*?)",
    );
  });
});
