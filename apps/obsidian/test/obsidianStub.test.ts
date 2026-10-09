/**
 * Pins the behavior the stub reimplements, which the conformance check cannot
 * see. Cases were read off Obsidian 1.8.7's implementation, not guessed; to
 * redo that on a newer version see "Verifying the stub" in AGENTS.md.
 */

import { describe, expect, it } from "vitest";
import {
  TFolder,
  debounce,
  normalizePath,
  parseLinktext,
} from "./obsidianStub";

describe("normalizePath", () => {
  it("collapses repeated and backslash separators", () => {
    expect(normalizePath("a//b")).toBe("a/b");
    expect(normalizePath("a\\b")).toBe("a/b");
    expect(normalizePath("a\\\\//b")).toBe("a/b");
  });

  it("strips leading and trailing slashes", () => {
    expect(normalizePath("/a/b/")).toBe("a/b");
  });

  it("returns the root as / rather than empty", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("//")).toBe("/");
    expect(normalizePath("\\")).toBe("/");
  });

  it("does not trim, so surrounding space survives and guards the anchor", () => {
    expect(normalizePath(" /a/b/ ")).toBe(" /a/b/ ");
    expect(normalizePath(" a ")).toBe(" a ");
  });

  it("folds non-breaking spaces and normalizes to NFC", () => {
    expect(normalizePath("a\u00A0b")).toBe("a b");
    expect(normalizePath("a\u202Fb")).toBe("a b");
    expect(normalizePath("cafe\u0301.md")).toBe("café.md");
  });

  it("leaves an already-normal path alone", () => {
    expect(normalizePath("notes/a.md")).toBe("notes/a.md");
  });
});

describe("parseLinktext", () => {
  it("splits a subpath off, keeping the hash", () => {
    expect(parseLinktext("note#heading")).toEqual({
      path: "note",
      subpath: "#heading",
    });
  });

  it("returns an empty path for a same-file link", () => {
    expect(parseLinktext("#heading")).toEqual({
      path: "",
      subpath: "#heading",
    });
  });

  it("keeps a block ref whole in the subpath", () => {
    expect(parseLinktext("note#^block-id")).toEqual({
      path: "note",
      subpath: "#^block-id",
    });
  });

  it("splits on the first hash only", () => {
    expect(parseLinktext("note#a#b")).toEqual({
      path: "note",
      subpath: "#a#b",
    });
  });

  it("returns an empty subpath when there is no hash", () => {
    expect(parseLinktext("note")).toEqual({ path: "note", subpath: "" });
  });
});

describe("TFolder.isRoot", () => {
  it("decides by path, so a default folder is not the root", () => {
    expect(new TFolder().isRoot()).toBe(false);
  });

  it("is the root only at /", () => {
    const folder = new TFolder();
    folder.path = "/";
    expect(folder.isRoot()).toBe(true);
  });
});

describe("debounce", () => {
  it("diverges: runs the callback on every call, so tests stay synchronous", () => {
    const calls: number[] = [];
    const debounced = debounce((n: number) => calls.push(n));

    debounced(1);
    debounced(2);

    expect(calls).toEqual([1, 2]);
  });

  it("diverges: run() flushes nothing, because nothing is ever pending", () => {
    const calls: number[] = [];
    const debounced = debounce((n: number) => calls.push(n));

    debounced(1);
    expect(debounced.run()).toBeUndefined();
    expect(calls).toEqual([1]);
  });
});
