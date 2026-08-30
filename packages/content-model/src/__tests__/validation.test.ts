import { describe, expect, it } from "vitest";

import {
  assertDgDocument,
  dgDocumentSchemaVersion,
  isDgDocument,
  validateDgDocument,
  type DgDocument,
} from "@repo/content-model";

const validDocument: DgDocument = {
  version: dgDocumentSchemaVersion,
  title: {
    text: "Canonical title",
    annotations: [{ type: "bold", start: 0, end: 9 }],
  },
  body: {
    text: "A linked page\nNested block",
    annotations: [
      {
        type: "reference",
        referenceType: "page",
        target: "Page",
        start: 2,
        end: 13,
      },
      {
        type: "block",
        id: "root",
        blockType: "list-item",
        attributes: { listStyle: "bullet", depth: 0 },
        start: 0,
        end: 13,
      },
      {
        type: "block",
        id: "child",
        parentId: "root",
        blockType: "list-item",
        attributes: { listStyle: "bullet", depth: 1 },
        start: 14,
        end: 26,
      },
    ],
  },
};

describe("validateDgDocument", () => {
  it("accepts a versioned title/body document with typed references", () => {
    expect(validateDgDocument(validDocument)).toEqual({
      success: true,
      issues: [],
    });
    expect(isDgDocument(validDocument)).toBe(true);
    expect(assertDgDocument(validDocument)).toBe(validDocument);
  });

  it("rejects malformed spans and invalid title blocks", () => {
    const result = validateDgDocument({
      ...validDocument,
      title: {
        text: "Two\nlines",
        annotations: [
          {
            type: "block",
            id: "title-block",
            blockType: "paragraph",
            start: 0,
            end: 99,
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "Annotation ranges must stay within their text field.",
        "Title text cannot contain block annotations.",
        "Document titles must use a single line.",
      ]),
    );
  });

  it("rejects missing parents, cycles, and malformed references", () => {
    const result = validateDgDocument({
      ...validDocument,
      body: {
        text: "broken",
        annotations: [
          {
            type: "reference",
            referenceType: "unknown",
            target: "",
            start: 0,
            end: 6,
          },
          {
            type: "block",
            id: "a",
            parentId: "b",
            blockType: "paragraph",
            start: 0,
            end: 6,
          },
          {
            type: "block",
            id: "b",
            parentId: "a",
            blockType: "paragraph",
            start: 0,
            end: 6,
          },
          {
            type: "block",
            id: "orphan",
            parentId: "missing",
            blockType: "paragraph",
            start: 0,
            end: 6,
          },
        ],
      },
    });

    expect(result.success).toBe(false);
    expect(() => assertDgDocument(result)).toThrow("Invalid DgDocument");
    if (result.success) return;
    expect(result.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "Expected a supported reference type.",
        "Reference targets cannot be empty.",
        "Block parent relationships cannot contain cycles.",
        'Parent block "missing" does not exist.',
      ]),
    );
  });
});
