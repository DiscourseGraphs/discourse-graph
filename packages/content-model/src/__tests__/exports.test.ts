import { describe, expect, it } from "vitest";

import {
  contentTypes,
  createValidResult,
  dgDocumentSchemaVersion,
  isSupportedContentType,
  isValidTextRange,
  normalizeLineEndings,
  supportedContentTypes,
} from "@repo/content-model";

describe("@repo/content-model", () => {
  it("exports supported content type constants", () => {
    expect(supportedContentTypes).toEqual([
      "text/plain",
      "text/markdown",
      "text/roam+markdown",
      "text/obsidian+markdown",
      "application/roam+json",
      "application/vnd.discourse-graph.atjson+json; version=1",
    ]);
    expect(contentTypes.markdown).toBe("text/markdown");
    expect(isSupportedContentType(contentTypes.discourseGraphAtJson)).toBe(
      true,
    );
    expect(isSupportedContentType("application/json")).toBe(false);
  });

  it("exports scaffold modules for the content model package", () => {
    expect(dgDocumentSchemaVersion).toBe(1);
    expect(createValidResult()).toEqual({ success: true, issues: [] });
    expect(normalizeLineEndings("a\r\nb\rc")).toBe("a\nb\nc");
    expect(isValidTextRange({ start: 1, end: 2 })).toBe(true);
  });
});
