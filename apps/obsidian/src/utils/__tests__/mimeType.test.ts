import { describe, expect, it } from "vitest";
import { DEFAULT_MIME_TYPE, getMimeTypeForPath } from "~/utils/mimeType";

describe("getMimeTypeForPath", () => {
  it("resolves common attachment types", () => {
    expect(getMimeTypeForPath("assets/diagram.png")).toBe("image/png");
    expect(getMimeTypeForPath("notes/paper.pdf")).toBe("application/pdf");
    expect(getMimeTypeForPath("clip.mp4")).toBe("video/mp4");
  });

  it("is case insensitive", () => {
    expect(getMimeTypeForPath("Photo.JPG")).toBe("image/jpeg");
  });

  it("prefixes text formats with text/ so callers can skip them", () => {
    expect(getMimeTypeForPath("note.md").startsWith("text/")).toBe(true);
    expect(getMimeTypeForPath("data.csv").startsWith("text/")).toBe(true);
  });

  it("uses the last extension of a multi-dot name", () => {
    expect(getMimeTypeForPath("archive.tar.png")).toBe("image/png");
  });

  it("falls back for unknown and extensionless paths", () => {
    expect(getMimeTypeForPath("notes/README")).toBe(DEFAULT_MIME_TYPE);
    expect(getMimeTypeForPath("thing.unknownext")).toBe(DEFAULT_MIME_TYPE);
  });

  it("does not treat a dotfile as an extension", () => {
    expect(getMimeTypeForPath(".gitignore")).toBe(DEFAULT_MIME_TYPE);
  });

  it("ignores dots in parent directories", () => {
    expect(getMimeTypeForPath("my.folder/file")).toBe(DEFAULT_MIME_TYPE);
  });
});
