import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type {
  ChangeType,
  ObsidianDiscourseNodeData,
} from "~/utils/syncDgNodesToSupabase";
import { buildNodeContentsWithEmbeddings } from "~/utils/upsertNodesAsContentWithEmbeddings";

const ACCOUNT_LOCAL_ID = "account-1";

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
  it("gives a new node its title with an embedding and its full text", async () => {
    const contentsByNodeId = await buildNodeContentsWithEmbeddings({
      obsidianNodes: [
        changedNode({
          nodeInstanceId: "node-1",
          basename: "CLM - Claim",
          changeTypes: ["title", "content"],
        }),
      ],
      accountLocalId: ACCOUNT_LOCAL_ID,
      plugin,
    });

    expect(contentsByNodeId).toEqual({
      "node-1": [
        expect.objectContaining({
          source_local_id: "node-1",
          author_local_id: ACCOUNT_LOCAL_ID,
          variant: "direct",
          text: "CLM - Claim",
          embedding_inline: {
            model: "openai_text_embedding_3_small_1536",
            vector: ["CLM - Claim".length],
          },
        }),
        expect.objectContaining({
          source_local_id: "node-1",
          variant: "full",
          text: "body of CLM - Claim.md",
        }),
      ],
    });
    expect(contentsByNodeId["node-1"]?.[1]).not.toHaveProperty(
      "embedding_inline",
    );
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
      accountLocalId: ACCOUNT_LOCAL_ID,
      plugin,
    });

    expect(contentsByNodeId).toEqual({
      "node-1": [expect.objectContaining({ variant: "full" })],
    });
    expect(fetchEmbeddings).not.toHaveBeenCalled();
  });

  it("keeps each node's Content under its own id", async () => {
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
      accountLocalId: ACCOUNT_LOCAL_ID,
      plugin,
    });

    expect(contentsByNodeId).toEqual({
      "node-1": [
        expect.objectContaining({ variant: "direct", text: "CLM - First" }),
      ],
      "node-2": [
        expect.objectContaining({ variant: "direct", text: "CLM - Second" }),
        expect.objectContaining({
          variant: "full",
          text: "body of CLM - Second.md",
        }),
      ],
    });
  });
});
