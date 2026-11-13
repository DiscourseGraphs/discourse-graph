import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import type { SupabaseContext } from "~/utils/supabaseContext";

vi.mock("~/utils/getDiscourseNodes", () => ({ default: () => [] }));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("~/components/settings/utils/accessors", () => ({
  isSyncEnabled: () => true,
}));
vi.mock("@repo/database/lib/pagination", () => ({
  getAllPages: () => Promise.resolve([]),
}));
vi.mock("~/utils/getAllDiscourseNodesSince", () => ({
  getAllDiscourseNodesSince: vi.fn(),
  nodeTypeSince: (_since: number | undefined, nodeTypes: DiscourseNode[]) =>
    Promise.resolve(nodeTypes),
}));
vi.mock("~/utils/conceptConversion", () => ({
  discourseNodeSchemaToLocalConcept: (
    _context: SupabaseContext,
    node: DiscourseNode,
  ): LocalConceptDataInput => ({
    source_local_id: node.type,
    name: node.text,
    is_schema: true,
  }),
  orderConceptsByDependency: (concepts: LocalConceptDataInput[]) => ({
    ordered: concepts,
    missing: [],
  }),
}));

import {
  convertDgToSupabaseConcepts,
  omitMissingSources,
  upsertNodesWithEmbeddings,
  withFullContent,
} from "~/utils/syncDgNodesToSupabase";

const claimType: DiscourseNode = {
  type: "claim-type",
  text: "Claim",
  shortcut: "C",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "[[CLM]] - {content}",
};

const questionType: DiscourseNode = {
  ...claimType,
  type: "question-type",
  text: "Question",
  shortcut: "Q",
  format: "[[QUE]] - {content}",
};

const nodeTypeRow = (sourceLocalId: string, title: string) => ({
  source_local_id: sourceLocalId,
  created: 1000,
  last_modified: 2000,
  author_local_id: "user-1",
  text: title,
  author_name: "User",
});

const context = { spaceId: 20, userId: 7 } as SupabaseContext;

const makeClient = () => {
  const rpc = vi.fn().mockResolvedValue({ data: [1], error: null });
  const query = { select: () => query, eq: () => query, order: () => query };
  return {
    rpc,
    client: { rpc, from: () => query } as unknown as DGSupabaseClient,
  };
};

const upsertedConcepts = (rpc: ReturnType<typeof makeClient>["rpc"]) =>
  rpc.mock.calls.map(
    ([fn, { data }]) => [fn, data] as [string, LocalConceptDataInput[]],
  );

const stubRoam = (nodeTypeRows: unknown[] = []) =>
  vi.stubGlobal("window", {
    roamAlphaAPI: {
      data: { backend: { q: () => Promise.resolve(nodeTypeRows) } },
    },
  });

const crossAppNode = (
  localId: string,
  content: Partial<CrossAppNode["content"]> = {},
): CrossAppNode => ({
  localId,
  authorId: "user-1",
  nodeType: "claim-type",
  coreTitle: "claim",
  createdAt: new Date(1000),
  modifiedAt: new Date(2000),
  content: { direct: { localId, value: "[[CLM]] - claim" }, ...content },
});

describe("convertDgToSupabaseConcepts node types", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends each node type's Content inside its own schema Concept", async () => {
    stubRoam([
      nodeTypeRow("claim-type", "discourse-graph/nodes/Claim"),
      nodeTypeRow("question-type", "discourse-graph/nodes/Question"),
    ]);
    const { rpc, client } = makeClient();

    await convertDgToSupabaseConcepts({
      nodes: [],
      since: undefined,
      allNodeTypes: [claimType, questionType],
      supabaseClient: client,
      context,
    });

    expect(rpc.mock.calls.map(([fn]) => fn as string)).toEqual([
      "upsert_concepts",
    ]);
    const [, { data }] = rpc.mock.calls[0] as [
      string,
      { data: LocalConceptDataInput[] },
    ];
    expect(data).toEqual([
      expect.objectContaining({
        source_local_id: "claim-type",
        is_schema: true,
        contents_inline: [
          expect.objectContaining({
            source_local_id: "claim-type",
            text: "discourse-graph/nodes/Claim",
            variant: "direct",
            author_local_id: "user-1",
          }),
        ],
      }),
      expect.objectContaining({
        source_local_id: "question-type",
        is_schema: true,
        contents_inline: [
          expect.objectContaining({
            source_local_id: "question-type",
            text: "discourse-graph/nodes/Question",
          }),
        ],
      }),
    ]);
  });
});

describe("convertDgToSupabaseConcepts nodes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends each node's Contents inside its Concept", async () => {
    stubRoam();
    const { rpc, client } = makeClient();

    await convertDgToSupabaseConcepts({
      nodes: [
        crossAppNode("node-1", {
          directAndDescription: {
            localId: "node-1",
            value: "[[CLM]] - claim Subjects recalled more",
            embedding: { value: [0.1, 0.2] },
          },
          full: {
            localId: "node-1",
            value: "- Subjects recalled more\n",
            contentType: "text/roam+markdown",
          },
        }),
      ],
      since: undefined,
      allNodeTypes: [],
      supabaseClient: client,
      context,
    });

    const [[fn, [concept]]] = upsertedConcepts(rpc);
    expect(fn).toBe("upsert_concepts");
    expect(concept).toMatchObject({
      source_local_id: "node-1",
      name: "[[CLM]] - claim",
      schema_represented_by_local_id: "claim-type",
      literal_content: { core_title: "claim" },
    });
    expect(
      concept.contents_inline?.map((content) => [
        content.variant,
        content.embedding_inline?.vector,
      ]),
    ).toEqual([
      ["direct", undefined],
      ["direct_and_description", [0.1, 0.2]],
      ["full", undefined],
    ]);
  });

  it("sends at most 50 Concepts per call", async () => {
    stubRoam();
    const { rpc, client } = makeClient();

    await convertDgToSupabaseConcepts({
      nodes: Array.from({ length: 51 }, (_, i) => crossAppNode(`node-${i}`)),
      since: undefined,
      allNodeTypes: [],
      supabaseClient: client,
      context,
    });

    expect(upsertedConcepts(rpc).map(([, data]) => data.length)).toEqual([
      50, 1,
    ]);
  });

  it("sends every batch before failing on a row that did not upsert", async () => {
    stubRoam();
    const { rpc, client } = makeClient();
    rpc
      .mockResolvedValueOnce({ data: [-2], error: null })
      .mockResolvedValueOnce({ data: [1], error: null });

    await expect(
      convertDgToSupabaseConcepts({
        nodes: Array.from({ length: 51 }, (_, i) => crossAppNode(`node-${i}`)),
        since: undefined,
        allNodeTypes: [],
        supabaseClient: client,
        context,
      }),
    ).rejects.toThrow("batch 1/2: -2: 1");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe("omitMissingSources", () => {
  const withSource = (localId: string, sourceId: string) => ({
    ...crossAppNode(localId),
    slots: { sourceDocument: sourceId },
  });

  it("keeps a Source that is a RID, in the same upsert, or already a Concept", () => {
    const nodes = [
      withSource("node-1", "orn:obsidian.note:vault-a/source-1"),
      withSource("node-2", "node-3"),
      crossAppNode("node-3"),
      withSource("node-4", "synced-source"),
    ];

    expect(
      omitMissingSources({ nodes, conceptIds: new Set(["synced-source"]) }),
    ).toEqual(nodes);
  });

  it("drops a Source that is not in the space, so the node still upserts", () => {
    const [node] = omitMissingSources({
      nodes: [withSource("node-1", "unsynced-source")],
      conceptIds: new Set(),
    });

    expect(node.slots).toBeUndefined();
  });
});

describe("withFullContent", () => {
  it("adds the full content to a node that also changed, keeping its page edit time", () => {
    const fullContent = {
      ...crossAppNode("node-1", {
        full: {
          localId: "node-1",
          value: "- body\n",
          contentType: "text/roam+markdown",
        },
      }),
      modifiedAt: new Date(3000),
    };
    const changed = crossAppNode("node-1", {
      directAndDescription: { localId: "node-1", value: "with description" },
    });

    const [node] = withFullContent([changed], [fullContent]);

    expect(node.content).toEqual({
      ...changed.content,
      full: { ...fullContent.content.full, modifiedAt: new Date(3000) },
    });
    expect(node.modifiedAt).toEqual(new Date(2000));
  });

  it("keeps the nodes sent only for their full content", () => {
    const fullContent = crossAppNode("node-2", {
      full: {
        localId: "node-2",
        value: "- body\n",
        contentType: "text/roam+markdown",
      },
    });

    expect(
      withFullContent([crossAppNode("node-1")], [fullContent]).map(
        ({ localId }) => localId,
      ),
    ).toEqual(["node-1", "node-2"]);
  });
});

describe("upsertNodesWithEmbeddings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("embeds the description of a block-backed node and the title of a page node", async () => {
    stubRoam();
    vi.stubEnv("NEXT_API_ROOT", "https://api.test/");
    const embeddedTexts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, { body }: { body: string }) => {
        const { input } = JSON.parse(body) as { input: string[] };
        embeddedTexts.push(...input);
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: input.map((_, i) => ({ embedding: [i] })),
            }),
        });
      }),
    );
    const { rpc, client } = makeClient();
    const nodeData = {
      author_local_id: "user-1",
      created: 1000,
      last_modified: 2000,
      type: "claim-type",
    };

    await upsertNodesWithEmbeddings({
      nodes: [
        { ...nodeData, source_local_id: "page-node", text: "[[CLM]] - page" },
        {
          ...nodeData,
          source_local_id: "block-node",
          text: "Subjects recalled more",
          node_title: "[[CLM]] - block",
        },
      ],
      nodeType: claimType,
      supabaseClient: client,
      context,
    });

    expect(embeddedTexts).toEqual([
      "[[CLM]] - page",
      "[[CLM]] - block Subjects recalled more",
    ]);
    const [[fn, concepts]] = upsertedConcepts(rpc);
    expect(fn).toBe("upsert_concepts");
    expect(
      concepts.map((concept) => [
        concept.source_local_id,
        concept.contents_inline?.map((content) => [
          content.variant,
          content.embedding_inline?.vector,
        ]),
      ]),
    ).toEqual([
      ["claim-type", []],
      ["page-node", [["direct", [0]]]],
      [
        "block-node",
        [
          ["direct", undefined],
          ["direct_and_description", [1]],
        ],
      ],
    ]);
  });
});
