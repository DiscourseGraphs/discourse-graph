import { describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "../client";
import {
  getNodeTypeRid,
  getSharedNodeByRid,
  getSharedNodeSpace,
  listGroupSharedNodes,
  type SharedNodeRows,
} from "../sharedNodes";

const spaces: SharedNodeRows["spaces"] = [
  {
    id: 20,
    name: "Research vault",
    platform: "Obsidian",
    url: "obsidian:vault-a",
  },
];
const nodes: SharedNodeRows["nodes"] = [
  {
    core_title: "REM sleep and recall",
    is_schema: false,
    last_modified: "2026-06-14T12:00:00",
    schema_id: 200,
    source_local_id: "node-1",
    space_id: 20,
    reference_content: {},
    concepts_of_relation: [],
  },
];
const directContents: SharedNodeRows["directContents"] = [
  {
    author_id: 42,
    created: "2026-06-14T11:00:00",
    last_modified: "2026-06-14T13:00:00",
    source_local_id: "node-1",
    space_id: 20,
    text: "EVD - REM sleep and recall",
    variant: "direct",
  },
];
const fullContentSummaries: SharedNodeRows["fullContentSummaries"] = [
  {
    last_modified: "2026-06-14T15:00:00",
    source_local_id: "node-1",
    space_id: 20,
  },
];
const rid = "orn:obsidian.note:vault-a/node-1";

type QueryResult = { data: unknown; error: { message: string } | null };

const makeQueryBuilder = (result: QueryResult) => {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    not: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (
      resolve: (value: QueryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.not.mockReturnValue(builder);
  return builder;
};

const schemaRows = [
  {
    id: 200,
    space_id: 20,
    source_local_id: "evd-type",
    is_schema: true,
    is_relation: false,
  },
];
const accountRows = [{ id: 42, account_local_id: "account-42" }];

const makeClient = ({
  space,
  concepts = nodes,
  direct = directContents,
  full = fullContentSummaries,
}: {
  space: SharedNodeRows["spaces"][number] | null;
  concepts?: SharedNodeRows["nodes"];
  direct?: SharedNodeRows["directContents"];
  full?: SharedNodeRows["fullContentSummaries"];
}) => {
  const spacesBuilder = makeQueryBuilder({ data: space, error: null });
  const conceptsBuilder = makeQueryBuilder({ data: concepts, error: null });
  const schemasBuilder = makeQueryBuilder({ data: schemaRows, error: null });
  const accountsBuilder = makeQueryBuilder({ data: accountRows, error: null });
  let conceptQueries = 0;
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
      : table === "my_accounts"
        ? accountsBuilder
        : table === "my_concepts"
          ? conceptQueries++ === 0
            ? conceptsBuilder
            : schemasBuilder
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
      node: {
        rid,
        localId: "node-1",
        createdAt: new Date("2026-06-14T11:00:00.000Z"),
        modifiedAt: new Date("2026-06-14T15:00:00.000Z"),
        authorId: "account-42",
        nodeType: "evd-type",
        coreTitle: "REM sleep and recall",
        content: { direct: { value: "EVD - REM sleep and recall" } },
      },
      space: {
        id: 20,
        name: "Research vault",
        platform: "Obsidian",
        url: "obsidian:vault-a",
      },
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

  it.each([
    { reason: "has no direct content", direct: [] },
    {
      reason: "has an author the group can't see",
      direct: [{ ...directContents[0]!, author_id: 99 }],
    },
  ])(
    "throws when the shared node $reason, rather than report it unshared",
    async ({ direct }) => {
      const { client } = makeClient({ space: spaces[0]!, direct });

      await expect(getSharedNodeByRid({ client, rid })).rejects.toThrow(
        `${rid} is shared but could not be read`,
      );
    },
  );

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

describe("listGroupSharedNodes", () => {
  const makeListingClient = (
    rowsByTable: Record<string, (filters: Record<string, unknown>) => unknown>,
  ): DGSupabaseClient => {
    const from = vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      const builder = {
        select: () => builder,
        neq: () => builder,
        not: () => builder,
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        in: (column: string, value: unknown) => {
          filters[`in ${column}`] = value;
          return builder;
        },
        then: (
          resolve: (value: QueryResult) => unknown,
          reject?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve({
            data: rowsByTable[table]!(filters),
            error: null,
          }).then(resolve, reject),
      };
      return builder;
    });
    return { from } as unknown as DGSupabaseClient;
  };

  it("lists nodes newest first, with their visible spaces by url", async () => {
    const olderNode = {
      ...nodes[0]!,
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
    };
    const olderDirect = {
      ...directContents[0]!,
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
      text: "EVD - Older shared node",
    };
    const client = makeListingClient({
      my_concepts: (filters) =>
        "in id" in filters ? schemaRows : [olderNode, nodes[0]!],
      my_contents: (filters) =>
        filters.variant === "direct"
          ? [olderDirect, ...directContents]
          : fullContentSummaries,
      my_spaces: () => [
        ...spaces,
        { id: 21, name: null, platform: "Obsidian", url: "obsidian:vault-b" },
      ],
      my_accounts: () => accountRows,
    });

    const listing = await listGroupSharedNodes({
      client,
      currentSpaceId: 10,
    });

    expect(listing.nodes.map(({ localId }) => localId)).toEqual([
      "node-1",
      "node-2",
    ]);
    expect(listing.spaces).toEqual({
      "obsidian:vault-a": {
        id: 20,
        name: "Research vault",
        platform: "Obsidian",
        url: "obsidian:vault-a",
      },
    });
  });
});

const crossAppNode = {
  rid,
  localId: "node-1",
  nodeType: "evd-type",
  coreTitle: "REM sleep and recall",
  content: { direct: { value: "EVD - REM sleep and recall" } },
  createdAt: new Date("2026-06-14T11:00:00.000Z"),
  modifiedAt: new Date("2026-06-14T15:00:00.000Z"),
  authorId: "account-42",
};

describe("getSharedNodeSpace", () => {
  const space = {
    id: 20,
    name: "Research vault",
    platform: "Obsidian" as const,
    url: "obsidian:vault-a",
  };

  it("finds a node's space by the space in its rid", () => {
    expect(
      getSharedNodeSpace({
        node: crossAppNode,
        spaces: { [space.url]: space },
      }),
    ).toEqual(space);
  });

  it("throws when the node's space is not listed", () => {
    expect(() =>
      getSharedNodeSpace({ node: crossAppNode, spaces: {} }),
    ).toThrow(`Missing the space of ${rid}`);
  });
});

describe("getNodeTypeRid", () => {
  it.each([
    {
      platform: "Obsidian",
      nodeRid: rid,
      schemaRid: "orn:obsidian.schema:vault-a/evd-type",
    },
    {
      platform: "Roam",
      nodeRid: "https://roamresearch.com/#/app/research-graph/roam-uid-1",
      schemaRid: "https://roamresearch.com/#/app/research-graph/evd-type",
    },
  ])(
    "gives the rid of a $platform node's type in the node's space",
    ({ nodeRid, schemaRid }) => {
      expect(getNodeTypeRid({ ...crossAppNode, rid: nodeRid })).toBe(schemaRid);
    },
  );
});
