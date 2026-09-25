import { describe, expect, it } from "vitest";
import { noteFileNameFromTitle } from "~/utils/noteFileName";

describe("noteFileNameFromTitle", () => {
  it("keeps a plain title", () => {
    expect(noteFileNameFromTitle("CLM - sleep improves memory")).toBe(
      "CLM - sleep improves memory",
    );
  });

  it("unwraps Roam page references in the title", () => {
    expect(
      noteFileNameFromTitle(
        "[[EVD]] - REM sleep aids recall - [[@Smith 2020]]",
      ),
    ).toBe("EVD - REM sleep aids recall - @Smith 2020");
  });

  it("drops the characters Obsidian rejects in file names", () => {
    expect(noteFileNameFromTitle('a<b>c:d"e/f\\g|h?i*j#k^l[m]n')).toBe(
      "abcdefghijklmn",
    );
  });

  it("drops a stray bracket that is not a page reference", () => {
    expect(noteFileNameFromTitle("[[unclosed - [tag] - x")).toBe(
      "unclosed - tag - x",
    );
  });

  it("drops a slash rather than making a folder", () => {
    expect(noteFileNameFromTitle("Projects/Alpha")).toBe("ProjectsAlpha");
  });

  it("collapses whitespace left behind", () => {
    expect(noteFileNameFromTitle("  #tag   - x  ")).toBe("tag - x");
  });

  it("returns an empty string when nothing survives", () => {
    expect(noteFileNameFromTitle("[[]]")).toBe("");
    expect(noteFileNameFromTitle("#")).toBe("");
  });

  it("unwraps nested and adjacent references", () => {
    expect(noteFileNameFromTitle("[[a [[b]] c]]")).toBe("a b c");
    expect(noteFileNameFromTitle("[[EVD]][[x]]")).toBe("EVDx");
  });

  it("does not treat a pipe inside a reference as an alias", () => {
    expect(noteFileNameFromTitle("[[Page|alias]]")).toBe("Pagealias");
  });

  it("passes non-ASCII titles through", () => {
    expect(
      noteFileNameFromTitle("[[EVD]] - Schlaf verbessert Gedächtnis"),
    ).toBe("EVD - Schlaf verbessert Gedächtnis");
  });
});
