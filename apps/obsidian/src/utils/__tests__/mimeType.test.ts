import { describe, expect, it } from "vitest";
import { DEFAULT_MIME_TYPE, getMimeTypeForPath } from "~/utils/mimeType";

describe("getMimeTypeForPath", () => {
  it("types the attachment kinds Obsidian accepts", () => {
    expect(getMimeTypeForPath("a/b.png")).toBe("image/png");
    expect(getMimeTypeForPath("a/b.pdf")).toBe("application/pdf");
    expect(getMimeTypeForPath("a/b.mp4")).toBe("video/mp4");
    expect(getMimeTypeForPath("a/b.mp3")).toBe("audio/mpeg");
  });

  it("ignores extension case", () => {
    expect(getMimeTypeForPath("A.PNG")).toBe("image/png");
    expect(getMimeTypeForPath("A.JpEg")).toBe("image/jpeg");
  });

  // The caller skips every `text/` attachment, so an extension missing from the
  // table would start being uploaded. Transcluded notes are the common case.
  it("keeps transcluded text files under a text/ type", () => {
    for (const path of ["note.md", "note.markdown", "a.mdx", "a.txt", "a.csv"])
      expect(getMimeTypeForPath(path).startsWith("text/")).toBe(true);
  });

  it("does not classify xml as text, which would stop it being uploaded", () => {
    expect(getMimeTypeForPath("a.xml")).toBe("application/xml");
  });

  it("uses the last extension of a multi-dot name", () => {
    expect(getMimeTypeForPath("archive.tar.png")).toBe("image/png");
  });

  it("ignores dots in parent directories", () => {
    expect(getMimeTypeForPath("folder.v2/asset.png")).toBe("image/png");
  });

  it("falls back for unknown, extensionless and dotfile paths", () => {
    expect(getMimeTypeForPath("a.unknownext")).toBe(DEFAULT_MIME_TYPE);
    expect(getMimeTypeForPath("noextension")).toBe(DEFAULT_MIME_TYPE);
    expect(getMimeTypeForPath("dir/.config")).toBe(DEFAULT_MIME_TYPE);
    expect(getMimeTypeForPath("trailing.")).toBe(DEFAULT_MIME_TYPE);
  });
});
