import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { isTutorialNote } from "~/components/tutorial/useCreatedNotes";

const fileWithExtension = (extension: string): TFile =>
  Object.assign(new TFile(), { extension });

describe("isTutorialNote", () => {
  it("counts notes, Bases and canvases the user made", () => {
    for (const extension of ["md", "base", "canvas"]) {
      expect(isTutorialNote(fileWithExtension(extension))).toBe(true);
    }
  });

  it("skips plugin data such as relations.json", () => {
    expect(isTutorialNote(fileWithExtension("json"))).toBe(false);
  });
});
