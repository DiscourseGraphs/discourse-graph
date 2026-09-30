import type { App, TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import {
  LOCAL_AUTHOR_NAME,
  UNRESOLVED_AUTHOR_NAME,
  resolveAuthorName,
} from "~/utils/discourseNodeAuthor";

/** Only the slice of `App` this code path reads; cast rather than stubbed whole. */
const makeApp = (frontmatter: Record<string, unknown> | undefined): App =>
  ({
    metadataCache: { getFileCache: () => ({ frontmatter }) },
  }) as unknown as App;

const file = { path: "note.md" } as TFile;

describe("resolveAuthorName", () => {
  it("reads the name for a known authorId", () => {
    expect(
      resolveAuthorName({
        app: makeApp({ authorId: 7 }),
        file,
        userNames: { 7: "Alice" },
      }),
    ).toBe("Alice");
  });

  it("treats a missing authorId as the local user", () => {
    expect(resolveAuthorName({ app: makeApp({}), file, userNames: {} })).toBe(
      LOCAL_AUTHOR_NAME,
    );
    expect(
      resolveAuthorName({ app: makeApp(undefined), file, userNames: {} }),
    ).toBe(LOCAL_AUTHOR_NAME);
  });

  it("does not claim a present but unresolvable authorId as the local user", () => {
    expect(
      resolveAuthorName({ app: makeApp({ authorId: 7 }), file, userNames: {} }),
    ).toBe(UNRESOLVED_AUTHOR_NAME);
    expect(
      resolveAuthorName({
        app: makeApp({ authorId: "seven" }),
        file,
        userNames: { 7: "Alice" },
      }),
    ).toBe(UNRESOLVED_AUTHOR_NAME);
  });
});
