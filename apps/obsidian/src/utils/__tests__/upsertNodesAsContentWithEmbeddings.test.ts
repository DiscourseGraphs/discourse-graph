import { afterEach, describe, expect, it, vi } from "vitest";

import { contentTypes } from "@repo/content-model";
import {
  convertObsidianNodeToLocalContent,
  fetchEmbeddingsForNodes,
} from "../upsertNodesAsContentWithEmbeddings";

describe("Obsidian content representations", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("dual-writes native Markdown and canonical ATJSON", async () => {
    const read = vi.fn().mockResolvedValue("# Evidence\nSupporting body");

    const entries = await convertObsidianNodeToLocalContent({
      accountLocalId: "account-1",
      nodes: [
        {
          changeTypes: ["title", "content"],
          created: "2026-08-30T00:00:00",
          file: { basename: "Evidence", path: "Evidence.md" },
          frontmatter: { status: "reviewed" },
          last_modified: "2026-08-30T00:00:00",
          nodeInstanceId: "claim-1",
        },
      ] as never,
      plugin: { app: { vault: { read } } } as never,
    });

    expect(entries.map((entry) => entry.content_type)).toEqual([
      contentTypes.plainText,
      contentTypes.markdown,
      contentTypes.discourseGraphAtJson,
    ]);
    const native = entries[1];
    const canonical = entries[2];
    expect(native).toMatchObject({
      text: "# Evidence\nSupporting body",
      variant: "full",
    });
    expect(native).not.toHaveProperty("original");
    expect(canonical).toMatchObject({
      original: false,
      variant: "full",
    });
    expect(canonical?.text).toContain("Supporting body");
    expect(canonical?.text).not.toContain('"version"');
    expect(canonical?.metadata).toMatchObject({
      content: { version: 1 },
    });
  });

  it("rejects non-plain embedding inputs before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchEmbeddingsForNodes([
        {
          content_type: contentTypes.discourseGraphAtJson,
          text: "Canonical plain text",
        },
      ]),
    ).rejects.toThrow("text/plain");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
