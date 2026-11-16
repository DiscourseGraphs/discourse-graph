import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type {
  ChangeType,
  ObsidianDiscourseNodeData,
} from "~/utils/syncDgNodesToSupabase";
import { buildNodeContentsWithEmbeddings } from "~/utils/upsertNodesAsContentWithEmbeddings";

const plugin = {
  app: {
    vault: {
      read: (file: TFile) => Promise.resolve(`body of ${file.path}`),
    },
  },
} as unknown as DiscourseGraphPlugin;

const changedNode = ({
  nodeInstanceId,
  basename,
  changeTypes,
}: {
  nodeInstanceId: string;
  basename: string;
  changeTypes: ChangeType[];
}): ObsidianDiscourseNodeData => ({
  file: Object.assign(new TFile(), { path: `${basename}.md`, basename }),
  frontmatter: { nodeTypeId: "claim-type", nodeInstanceId },
  nodeTypeId: "claim-type",
  nodeInstanceId,
  created: "2026-10-01T00:00:00.000Z",
  last_modified: "2026-10-02T00:00:00.000Z",
  changeTypes,
});

const fetchEmbeddings = vi.fn((_url: string, init: RequestInit) => {
  const { input } = JSON.parse(init.body as string) as { input: string[] };
  return Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        data: input.map((text) => ({ embedding: [text.length] })),
      }),
  });
});

beforeEach(() => {
  fetchEmbeddings.mockClear();
  vi.stubGlobal("fetch", fetchEmbeddings);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildNodeContentsWithEmbeddings", () => {
  it("gives a new node its title's embedding and its full text", async () => {
    const contentsByNodeId = await buildNodeContentsWithEmbeddings({
      obsidianNodes: [
        changedNode({
          nodeInstanceId: "node-1",
          basename: "CLM - Claim",
          changeTypes: ["title", "content"],
        }),
      ],
      plugin,
    });

    expect(contentsByNodeId).toEqual({
      "node-1": {
        titleEmbedding: ["CLM - Claim".length],
        fullText: "body of CLM - Claim.md",
      },
    });
  });

  it("gives a content-only edit its full text and fetches no embedding", async () => {
    const contentsByNodeId = await buildNodeContentsWithEmbeddings({
      obsidianNodes: [
        changedNode({
          nodeInstanceId: "node-1",
          basename: "CLM - Claim",
          changeTypes: ["content"],
        }),
      ],
      plugin,
    });

    expect(contentsByNodeId).toEqual({
      "node-1": { fullText: "body of CLM - Claim.md" },
    });
    expect(fetchEmbeddings).not.toHaveBeenCalled();
  });

  it("keeps each node's title embedding and full text under its own id", async () => {
    const contentsByNodeId = await buildNodeContentsWithEmbeddings({
      obsidianNodes: [
        changedNode({
          nodeInstanceId: "node-1",
          basename: "CLM - First",
          changeTypes: ["title"],
        }),
        changedNode({
          nodeInstanceId: "node-2",
          basename: "CLM - Second",
          changeTypes: ["title", "content"],
        }),
        changedNode({
          nodeInstanceId: "node-3",
          basename: "CLM - Unchanged",
          changeTypes: [],
        }),
      ],
      plugin,
    });

    expect(contentsByNodeId).toEqual({
      "node-1": { titleEmbedding: ["CLM - First".length] },
      "node-2": {
        titleEmbedding: ["CLM - Second".length],
        fullText: "body of CLM - Second.md",
      },
    });
  });
});
