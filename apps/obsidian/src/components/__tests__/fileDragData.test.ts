import { describe, expect, it, vi } from "vitest";
import type { App, TFile } from "obsidian";
import { setFileDragData } from "~/components/fileDragData";

const makeDataTransfer = () => {
  const data = new Map<string, string>();
  return {
    data,
    setData: (format: string, value: string) => void data.set(format, value),
  };
};

const makeApp = (generateMarkdownLink: ReturnType<typeof vi.fn>) =>
  ({ fileManager: { generateMarkdownLink } }) as unknown as App;

const file = { path: "notes/Claim A.md" } as TFile;

describe("setFileDragData", () => {
  it("puts the generated link in text/plain", () => {
    const generateMarkdownLink = vi.fn().mockReturnValue("[[Claim A]]");
    const dataTransfer = makeDataTransfer();

    setFileDragData({
      dataTransfer: dataTransfer as unknown as DataTransfer,
      app: makeApp(generateMarkdownLink),
      file,
      sourcePath: "notes/Question B.md",
    });

    expect(dataTransfer.data.get("text/plain")).toBe("[[Claim A]]");
  });

  // Obsidian rewrites a drop carrying a URL into [text/plain](text/uri-list).
  it("sets no other slot, so Obsidian cannot rewrite the drop", () => {
    const dataTransfer = makeDataTransfer();

    setFileDragData({
      dataTransfer: dataTransfer as unknown as DataTransfer,
      app: makeApp(vi.fn().mockReturnValue("[[Claim A]]")),
      file,
      sourcePath: "notes/Question B.md",
    });

    expect([...dataTransfer.data.keys()]).toEqual(["text/plain"]);
  });

  // sourcePath is the note holding the panel. The drop target is unknown at
  // dragstart, so the relative-link-format case is deliberately not covered.
  it("formats the link against sourcePath, not the dragged file", () => {
    const generateMarkdownLink = vi
      .fn()
      .mockReturnValue("[Claim A](Claim%20A.md)");
    setFileDragData({
      dataTransfer: makeDataTransfer() as unknown as DataTransfer,
      app: makeApp(generateMarkdownLink),
      file,
      sourcePath: "notes/Question B.md",
    });

    expect(generateMarkdownLink).toHaveBeenCalledWith(
      file,
      "notes/Question B.md",
    );
  });

  it("does nothing when the event carries no dataTransfer", () => {
    const generateMarkdownLink = vi.fn();

    expect(() =>
      setFileDragData({
        dataTransfer: null,
        app: makeApp(generateMarkdownLink),
        file,
        sourcePath: "notes/Question B.md",
      }),
    ).not.toThrow();
    expect(generateMarkdownLink).not.toHaveBeenCalled();
  });
});
