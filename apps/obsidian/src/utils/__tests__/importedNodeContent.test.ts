import { describe, expect, it } from "vitest";
import {
  type ImportedNodeContentRow,
  resolveImportedNodeContent,
} from "~/utils/importedNodeContent";

const directRow = (
  overrides: Partial<ImportedNodeContentRow> = {},
): ImportedNodeContentRow => ({
  variant: "direct",
  text: "Note title",
  created: "2026-01-01T00:00:00",
  last_modified: "2026-01-02T00:00:00",
  author_id: 7,
  metadata: {},
  ...overrides,
});

const fullRow = (
  overrides: Partial<ImportedNodeContentRow> = {},
): ImportedNodeContentRow => ({
  variant: "full",
  text: "body",
  created: "2026-01-01T00:00:00",
  last_modified: "2026-01-02T00:00:00",
  author_id: 7,
  metadata: {},
  ...overrides,
});

describe("resolveImportedNodeContent", () => {
  it("pairs the direct title with the full body", () => {
    expect(resolveImportedNodeContent([directRow(), fullRow()])).toMatchObject({
      fileName: "Note title",
      content: "body",
      authorId: 7,
      createdAt: new Date("2026-01-01T00:00:00Z").valueOf(),
      modifiedAt: new Date("2026-01-02T00:00:00Z").valueOf(),
    });
  });

  it("accepts an empty body, which a titled node with no content publishes", () => {
    expect(
      resolveImportedNodeContent([directRow(), fullRow({ text: "" })]),
    ).toMatchObject({ fileName: "Note title", content: "" });
  });

  it("rejects a full row whose text is absent", () => {
    expect(
      resolveImportedNodeContent([directRow(), fullRow({ text: null })]),
    ).toBeNull();
  });

  it("rejects a node with no full row", () => {
    expect(resolveImportedNodeContent([directRow()])).toBeNull();
  });

  it("rejects a node with no title", () => {
    expect(
      resolveImportedNodeContent([directRow({ text: "" }), fullRow()]),
    ).toBeNull();
  });

  it("rejects a full row with no timestamps", () => {
    expect(
      resolveImportedNodeContent([
        directRow(),
        fullRow({ created: null, last_modified: null }),
      ]),
    ).toBeNull();
  });

  it("falls back to the direct row's author when the full row has none", () => {
    expect(
      resolveImportedNodeContent([directRow(), fullRow({ author_id: null })]),
    ).toMatchObject({ authorId: 7 });
  });

  it("rejects a node with no author on either row", () => {
    expect(
      resolveImportedNodeContent([
        directRow({ author_id: null }),
        fullRow({ author_id: null }),
      ]),
    ).toBeNull();
  });

  it("reads the source vault path from the direct row's metadata", () => {
    expect(
      resolveImportedNodeContent([
        directRow({ metadata: { filePath: "Notes/note.md" } }),
        fullRow(),
      ]),
    ).toMatchObject({ filePath: "Notes/note.md" });
  });

  it("leaves the path undefined when the metadata is an array", () => {
    expect(
      resolveImportedNodeContent([
        directRow({ metadata: ["Notes/note.md"] }),
        fullRow(),
      ]),
    ).toMatchObject({ filePath: undefined });
  });

  it("leaves the path undefined when the metadata does not carry one", () => {
    expect(
      resolveImportedNodeContent([
        directRow({ metadata: { filePath: 3 } }),
        fullRow(),
      ]),
    ).toMatchObject({ filePath: undefined });
  });
});
