import { describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "../client";
import { buildSharedNodes, getSharedNodeByRid } from "../sharedNodes";

type BuildArgs = Parameters<typeof buildSharedNodes>[0];

const spaces: BuildArgs["spaces"] = [
  {
    id: 20,
    name: "Research vault",
    platform: "Obsidian",
    url: "obsidian:vault-a",
  },
];
const nodes: BuildArgs["nodes"] = [
  {
    is_schema: false,
    last_modified: "2026-06-14T12:00:00",
    schema_id: 200,
    source_local_id: "node-1",
    space_id: 20,
    reference_content: {},
    concepts_of_relation: [],
  },
];
const directContents: BuildArgs["directContents"] = [
  {
    author_id: 42,
    created: "2026-06-14T11:00:00",
    last_modified: "2026-06-14T13:00:00",
    metadata: { source: "obsidian" },
    source_local_id: "node-1",
    space_id: 20,
    text: "EVD - REM sleep and recall",
    variant: "direct",
  },
];
const fullContentSummaries: BuildArgs["fullContentSummaries"] = [
  {
    last_modified: "2026-06-14T15:00:00",
    source_local_id: "node-1",
    space_id: 20,
  },
];
const rid = "orn:obsidian.note:vault-a/node-1";

const build = ({
  nodesOverride = nodes,
  directOverride = directContents,
  fullOverride = fullContentSummaries,
  spacesOverride = spaces,
}: {
  nodesOverride?: typeof nodes;
  directOverride?: typeof directContents;
  fullOverride?: typeof fullContentSummaries;
  spacesOverride?: typeof spaces;
} = {}) =>
  buildSharedNodes({
    nodes: nodesOverride,
    directContents: directOverride,
    fullContentSummaries: fullOverride,
    spaces: spacesOverride,
  });

describe("buildSharedNodes", () => {
  it("builds a group-shared contract node with stable source identity", () => {
    expect(build()).toEqual([
      {
        rid,
        sourceLocalId: "node-1",
        spaceId: 20,
        spaceName: "Research vault",
        spaceUri: "obsidian:vault-a",
        platform: "Obsidian",
        title: "EVD - REM sleep and recall",
        created: "2026-06-14T11:00:00.000Z",
        lastModified: "2026-06-14T15:00:00.000Z",
        authorId: 42,
        directMetadata: { source: "obsidian" },
      },
    ]);
  });

  it("builds a Roam-origin shared node with a URL-based rid", () => {
    const roamSpaces: BuildArgs["spaces"] = [
      {
        id: 30,
        name: "Research graph",
        platform: "Roam",
        url: "https://roamresearch.com/#/app/research-graph",
      },
    ];
    const roamNodes: BuildArgs["nodes"] = [
      { ...nodes[0]!, space_id: 30, source_local_id: "roam-uid-1" },
    ];
    const roamDirect: BuildArgs["directContents"] = [
      {
        ...directContents[0]!,
        space_id: 30,
        source_local_id: "roam-uid-1",
        metadata: null,
        text: "CLM - Sleep improves memory consolidation",
      },
    ];
    const roamFull: BuildArgs["fullContentSummaries"] = [
      {
        last_modified: "2026-06-14T15:00:00",
        source_local_id: "roam-uid-1",
        space_id: 30,
      },
    ];
    expect(
      build({
        nodesOverride: roamNodes,
        directOverride: roamDirect,
        fullOverride: roamFull,
        spacesOverride: roamSpaces,
      }),
    ).toEqual([
      {
        rid: "https://roamresearch.com/#/app/research-graph/roam-uid-1",
        sourceLocalId: "roam-uid-1",
        spaceId: 30,
        spaceName: "Research graph",
        spaceUri: "https://roamresearch.com/#/app/research-graph",
        platform: "Roam",
        title: "CLM - Sleep improves memory consolidation",
        created: "2026-06-14T11:00:00.000Z",
        lastModified: "2026-06-14T15:00:00.000Z",
        authorId: 42,
        directMetadata: null,
      },
    ]);
  });

  it("discovers a node without full content", () => {
    expect(build({ fullOverride: [] })[0]?.lastModified).toBe(
      "2026-06-14T13:00:00.000Z",
    );
  });

  it("falls back to the direct created date when no last-modified exists", () => {
    expect(
      build({
        nodesOverride: [{ ...nodes[0]!, last_modified: null }],
        directOverride: [{ ...directContents[0]!, last_modified: null }],
        fullOverride: [],
      })[0]?.lastModified,
    ).toBe("2026-06-14T11:00:00.000Z");
  });

  it.each([
    {
      name: "schema concept",
      nodesOverride: [{ ...nodes[0]!, is_schema: true }],
      directOverride: directContents,
    },
    {
      name: "missing node type",
      nodesOverride: [{ ...nodes[0]!, schema_id: null }],
      directOverride: directContents,
    },
    {
      name: "missing direct content",
      nodesOverride: nodes,
      directOverride: [],
    },
  ])("filters a node with $name", ({ nodesOverride, directOverride }) => {
    expect(build({ nodesOverride, directOverride })).toEqual([]);
  });

  it("sorts newest nodes first", () => {
    const olderNode = {
      ...nodes[0]!,
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
    };
    const olderDirect = {
      ...directContents[0]!,
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
      text: "Older shared node",
    };
    expect(
      build({
        nodesOverride: [olderNode, nodes[0]!],
        directOverride: [olderDirect, ...directContents],
        fullOverride: fullContentSummaries,
      }).map((node) => node.sourceLocalId),
    ).toEqual(["node-1", "node-2"]);
  });
});

type QueryResult = { data: unknown; error: { message: string } | null };

const makeQueryBuilder = (result: QueryResult) => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
};

const makeClient = ({
  space,
  concepts = nodes,
  direct = directContents,
  full = fullContentSummaries,
}: {
  space: BuildArgs["spaces"][number] | null;
  concepts?: BuildArgs["nodes"];
  direct?: BuildArgs["directContents"];
  full?: BuildArgs["fullContentSummaries"];
}) => {
  const spacesBuilder = makeQueryBuilder({ data: space, error: null });
  const conceptsBuilder = makeQueryBuilder({ data: concepts, error: null });
  const makeContentsBuilder = () => {
    let variant = "";
    const builder = {
      select: vi.fn(),
      eq: vi.fn(),
      then: (
        resolve: (value: QueryResult) => unknown,
        reject?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve({
          data: variant === "direct" ? direct : variant === "full" ? full : [],
          error: null,
        }).then(resolve, reject),
    };
    builder.select.mockReturnValue(builder);
    builder.eq.mockImplementation((column: string, value: unknown) => {
      if (column === "variant") variant = value as string;
      return builder;
    });
    return builder;
  };
  const from = vi.fn((table: string) =>
    table === "my_spaces"
      ? spacesBuilder
      : table === "my_concepts"
        ? conceptsBuilder
        : makeContentsBuilder(),
  );
  return {
    client: { from } as unknown as DGSupabaseClient,
    spacesBuilder,
    conceptsBuilder,
  };
};

describe("getSharedNodeByRid", () => {
  it("fetches one shared node by its stored rid", async () => {
    const { client, spacesBuilder, conceptsBuilder } = makeClient({
      space: spaces[0]!,
    });

    await expect(getSharedNodeByRid({ client, rid })).resolves.toEqual({
      rid,
      sourceLocalId: "node-1",
      spaceId: 20,
      spaceName: "Research vault",
      spaceUri: "obsidian:vault-a",
      platform: "Obsidian",
      title: "EVD - REM sleep and recall",
      created: "2026-06-14T11:00:00.000Z",
      lastModified: "2026-06-14T15:00:00.000Z",
      authorId: 42,
      directMetadata: { source: "obsidian" },
    });
    expect(spacesBuilder.eq).toHaveBeenCalledWith("url", "obsidian:vault-a");
    expect(conceptsBuilder.eq).toHaveBeenCalledWith("space_id", 20);
    expect(conceptsBuilder.eq).toHaveBeenCalledWith(
      "source_local_id",
      "node-1",
    );
  });

  it("queries with the space url and local id parsed from a URL-form rid", async () => {
    const { client, spacesBuilder, conceptsBuilder } = makeClient({
      space: {
        id: 30,
        name: "Research graph",
        platform: "Roam",
        url: "https://roamresearch.com/#/app/research-graph",
      },
      concepts: [],
      direct: [],
      full: [],
    });

    await expect(
      getSharedNodeByRid({
        client,
        rid: "https://roamresearch.com/#/app/research-graph/roam-uid-1",
      }),
    ).resolves.toBeNull();
    expect(spacesBuilder.eq).toHaveBeenCalledWith(
      "url",
      "https://roamresearch.com/#/app/research-graph",
    );
    expect(conceptsBuilder.eq).toHaveBeenCalledWith(
      "source_local_id",
      "roam-uid-1",
    );
  });

  it("returns null when the source space is not visible", async () => {
    const { client } = makeClient({ space: null });

    await expect(getSharedNodeByRid({ client, rid })).resolves.toBeNull();
  });

  it("returns null when the node has no direct content", async () => {
    const { client } = makeClient({ space: spaces[0]!, direct: [] });

    await expect(getSharedNodeByRid({ client, rid })).resolves.toBeNull();
  });

  it("throws when the space lookup fails", async () => {
    const failingBuilder = makeQueryBuilder({
      data: null,
      error: { message: "permission denied" },
    });
    const client = {
      from: vi.fn(() => failingBuilder),
    } as unknown as DGSupabaseClient;

    await expect(getSharedNodeByRid({ client, rid })).rejects.toEqual({
      message: "permission denied",
    });
  });
});
