import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { TFile } from "obsidian";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type {
  LocalConceptDataInput,
  LocalContentDataInput,
} from "@repo/database/inputTypes";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
  RelationInstance,
} from "~/types";
import {
  collectDiscourseNodesFromVault,
  type DiscourseNodeInVault,
} from "~/utils/getDiscourseNodes";
import { getRelationsFilePath } from "~/utils/relationsStore";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";
import {
  syncAllNodesAndRelations,
  syncDiscourseNodeChanges,
  upsertConceptBatches,
} from "~/utils/syncDgNodesToSupabase";

vi.mock("~/utils/supabaseContext", () => ({
  getSupabaseContext: vi.fn(),
  getLoggedInClient: vi.fn(),
  getLocalSpaceUri: () => "obsidian:local-vault",
}));

vi.mock("~/utils/getDiscourseNodes", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  collectDiscourseNodesFromVault: vi.fn(),
}));

const SPACE_ID = 7;

type RpcArgs = { data: LocalConceptDataInput[]; v_space_id: number };
type RpcResult = { data: number[] | null; error: unknown };

const fakeRpc = (
  respond: (args: RpcArgs) => RpcResult,
): Mock<(name: string, args: RpcArgs) => Promise<RpcResult>> =>
  vi.fn((_name: string, args: RpcArgs) => Promise.resolve(respond(args)));

const concepts = (count: number): LocalConceptDataInput[] =>
  Array.from({ length: count }, (_, i) => ({ source_local_id: `c${i}` }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("upsertConceptBatches", () => {
  it("sends the concepts to upsert_concepts in order, 50 per call", async () => {
    const rpc = fakeRpc(({ data }) => ({
      data: data.map((_, i) => i + 1),
      error: null,
    }));

    await upsertConceptBatches({
      concepts: concepts(120),
      supabaseClient: { rpc } as unknown as DGSupabaseClient,
      spaceId: SPACE_ID,
    });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "upsert_concepts",
      "upsert_concepts",
      "upsert_concepts",
    ]);
    const sentBatches = rpc.mock.calls.map(([, { data }]) =>
      data.map((concept) => concept.source_local_id),
    );
    expect(sentBatches.map((batch) => batch.length)).toEqual([50, 50, 20]);
    expect(sentBatches.flat()).toEqual(
      concepts(120).map((concept) => concept.source_local_id),
    );
  });

  it.each([
    ["a name conflict", -1],
    ["a failed write", -2],
  ])(
    "still sends the later batches when a row comes back as %s, then throws",
    async (_case, failedId) => {
      const rpc = fakeRpc(({ data }) => ({
        data: data.map((concept, i) =>
          concept.source_local_id === "c3" ? failedId : i + 1,
        ),
        error: null,
      }));

      await expect(
        upsertConceptBatches({
          concepts: concepts(120),
          supabaseClient: { rpc } as unknown as DGSupabaseClient,
          spaceId: SPACE_ID,
        }),
      ).rejects.toThrow(
        `upsert_concepts returned row failures for batch 1/3: ${failedId}: 1`,
      );
      expect(rpc).toHaveBeenCalledTimes(3);
    },
  );

  it("still sends the later batches when a call fails, then throws with every failure", async () => {
    const rpc = fakeRpc(({ data }) =>
      data[0]?.source_local_id === "c50"
        ? { data: null, error: { message: "statement timeout" } }
        : {
            data: data.map((concept) =>
              concept.source_local_id === "c101" ? -2 : 1,
            ),
            error: null,
          },
    );

    const upsert = upsertConceptBatches({
      concepts: concepts(120),
      supabaseClient: { rpc } as unknown as DGSupabaseClient,
      spaceId: SPACE_ID,
    });

    await expect(upsert).rejects.toThrow(
      "upsert_concepts failed for batch 2/3",
    );
    await expect(upsert).rejects.toThrow(
      "upsert_concepts returned row failures for batch 3/3: -2: 1",
    );
    expect(rpc).toHaveBeenCalledTimes(3);
  });
});

describe("what Obsidian sync sends to upsert_concepts", () => {
  const USER_ID = 3;
  const ACCOUNT_LOCAL_ID = "account-1";

  const SCHEMA_CREATED = "2026-01-01T00:00:00.000Z";
  const SCHEMA_MODIFIED = "2026-01-02T00:00:00.000Z";
  const NOTE_CREATED = "2026-03-01T00:00:00.000Z";
  const NOTE_MODIFIED = "2026-03-02T00:00:00.000Z";
  const RELATION_CREATED = "2026-04-01T00:00:00.000Z";
  const RELATION_MODIFIED = "2026-04-02T00:00:00.000Z";
  // The database returns timestamps without a zone; the sync appends "Z".
  const LAST_SYNCED = "2026-05-01T00:00:00";
  const NOTE_EDITED = "2026-06-01T00:00:00.000Z";

  const schemaTimes = {
    created: Date.parse(SCHEMA_CREATED),
    modified: Date.parse(SCHEMA_MODIFIED),
  };
  const CLAIM_TYPE: DiscourseNode = {
    id: "claim-type",
    name: "Claim",
    format: "CLM - {content}",
    description: "An assertion that evidence can support",
    template: "Claim template",
    color: "#7DA13E",
    tag: "clm",
    shortcut: "C",
    keyImage: true,
    folderPath: "Claims",
    ...schemaTimes,
  };
  const SOURCE_TYPE: DiscourseNode = {
    id: "source-type",
    name: "Source",
    format: "SRC - {content}",
    ...schemaTimes,
  };
  const IMPORTED_EVIDENCE_TYPE: DiscourseNode = {
    id: "evidence-type",
    name: "Evidence",
    format: "EVD - {content}",
    importedFromRid: "orn:obsidian.schema:other-vault/evidence-type",
    authorId: 9,
    ...schemaTimes,
  };
  const CITES_TYPE: DiscourseRelationType = {
    id: "cites-type",
    label: "cites",
    complement: "is cited by",
    color: "blue",
    ...schemaTimes,
  };
  const SUPPORTS_TYPE: DiscourseRelationType = {
    id: "supports-type",
    label: "supports",
    complement: "is supported by",
    color: "green",
    ...schemaTimes,
  };
  const IMPORTED_OPPOSES_TYPE: DiscourseRelationType = {
    id: "opposes-type",
    label: "opposes",
    complement: "is opposed by",
    color: "red",
    importedFromRid: "orn:obsidian.schema:other-vault/opposes-type",
    status: "accepted",
    authorId: 9,
    ...schemaTimes,
  };
  const CLAIM_CITES_SOURCE: DiscourseRelation = {
    id: "claim-cites-source",
    relationshipTypeId: "cites-type",
    sourceId: "claim-type",
    destinationId: "source-type",
    ...schemaTimes,
  };
  const CLAIM_SUPPORTS_CLAIM: DiscourseRelation = {
    id: "claim-supports-claim",
    relationshipTypeId: "supports-type",
    sourceId: "claim-type",
    destinationId: "claim-type",
    ...schemaTimes,
  };
  const IMPORTED_CLAIM_OPPOSES_CLAIM: DiscourseRelation = {
    id: "claim-opposes-claim",
    relationshipTypeId: "opposes-type",
    sourceId: "claim-type",
    destinationId: "claim-type",
    importedFromRid: "orn:obsidian.schema:other-vault/claim-opposes-claim",
    status: "accepted",
    authorId: 9,
    ...schemaTimes,
  };

  const note = ({
    path,
    nodeTypeId,
    nodeInstanceId,
    otherFrontmatter = {},
    modified = NOTE_MODIFIED,
  }: {
    path: string;
    nodeTypeId: string;
    nodeInstanceId: string;
    otherFrontmatter?: Record<string, unknown>;
    modified?: string;
  }): DiscourseNodeInVault => ({
    file: Object.assign(new TFile(), {
      path,
      basename: path.slice(path.lastIndexOf("/") + 1, -".md".length),
      stat: { ctime: Date.parse(NOTE_CREATED), mtime: Date.parse(modified) },
    }),
    frontmatter: { nodeTypeId, nodeInstanceId, ...otherFrontmatter },
    nodeTypeId,
    nodeInstanceId,
  });

  const CLAIM_PATH = "Claims/CLM - Sleep consolidates memory.md";
  const claimNote = (modified = NOTE_MODIFIED): DiscourseNodeInVault =>
    note({
      path: CLAIM_PATH,
      nodeTypeId: "claim-type",
      nodeInstanceId: "claim-node",
      otherFrontmatter: { tags: ["sleep"] },
      modified,
    });
  const SOURCE_NOTE = note({
    path: "Sources/SRC - Walker 2017.md",
    nodeTypeId: "source-type",
    nodeInstanceId: "source-node",
  });
  const IMPORTED_CLAIM_RID = "orn:obsidian.note:other-vault/remote-claim";
  const IMPORTED_NOTE = note({
    path: "Imported/CLM - Dreams replay the day.md",
    nodeTypeId: "claim-type",
    nodeInstanceId: "imported-claim",
    otherFrontmatter: { importedFromRid: IMPORTED_CLAIM_RID },
  });
  const TEMPLATE_FILE = Object.assign(new TFile(), {
    path: "Templates/Claim template.md",
  });
  const CLAIM_FILE_TEXT = [
    "---",
    "nodeTypeId: claim-type",
    "nodeInstanceId: claim-node",
    "tags:",
    "  - sleep",
    "---",
    "Sleep after learning strengthens recall.",
    "",
  ].join("\n");
  const TEXT_BY_PATH: Record<string, string> = {
    [CLAIM_PATH]: CLAIM_FILE_TEXT,
    [SOURCE_NOTE.file.path]: "Walker, M. (2017). Why we sleep.",
    [IMPORTED_NOTE.file.path]: "Dreams replay the day's events.",
    [TEMPLATE_FILE.path]: "## Evidence\n",
  };

  const relationTimes = {
    created: Date.parse(RELATION_CREATED),
    lastModified: Date.parse(RELATION_MODIFIED),
  };
  const CLAIM_CITES_WALKER: RelationInstance = {
    id: "rel-cites",
    type: "cites-type",
    source: "claim-node",
    destination: "source-node",
    ...relationTimes,
  };
  const CLAIM_SUPPORTS_IMPORTED: RelationInstance = {
    id: "rel-supports-imported",
    type: "supports-type",
    source: "claim-node",
    destination: "imported-claim",
    ...relationTimes,
  };
  const IMPORTED_RELATION: RelationInstance = {
    id: "rel-imported",
    type: "supports-type",
    source: "imported-claim",
    destination: "claim-node",
    importedFromRid: "orn:obsidian.relation:other-vault/remote-relation",
    ...relationTimes,
  };

  const embeddingOf = (text: string): number[] =>
    [...text].map((char) => char.charCodeAt(0));

  const CLAIM_CONCEPT: LocalConceptDataInput = {
    space_id: SPACE_ID,
    source_local_id: "claim-node",
    schema_represented_by_local_id: "claim-type",
    is_schema: false,
    author_id: USER_ID,
    name: CLAIM_PATH,
    created: NOTE_CREATED,
    last_modified: NOTE_MODIFIED,
    literal_content: {
      label: "CLM - Sleep consolidates memory",
      core_title: "Sleep consolidates memory",
      source_data: { tags: ["sleep"] },
    },
  };
  const CLAIM_DIRECT_CONTENT: LocalContentDataInput = {
    source_local_id: "claim-node",
    author_local_id: ACCOUNT_LOCAL_ID,
    creator_local_id: ACCOUNT_LOCAL_ID,
    scale: "document",
    created: NOTE_CREATED,
    last_modified: NOTE_MODIFIED,
    variant: "direct",
    content_type: "text/plain",
    text: "CLM - Sleep consolidates memory",
    metadata: { filePath: CLAIM_PATH },
    embedding_inline: {
      model: "openai_text_embedding_3_small_1536",
      vector: embeddingOf("CLM - Sleep consolidates memory"),
    },
  };
  const CLAIM_FULL_CONTENT: LocalContentDataInput = {
    source_local_id: "claim-node",
    author_local_id: ACCOUNT_LOCAL_ID,
    creator_local_id: ACCOUNT_LOCAL_ID,
    scale: "document",
    created: NOTE_CREATED,
    last_modified: NOTE_MODIFIED,
    variant: "full",
    content_type: "text/obsidian+markdown",
    text: CLAIM_FILE_TEXT,
    metadata: {
      nodeTypeId: "claim-type",
      nodeInstanceId: "claim-node",
      tags: ["sleep"],
    },
  };

  const resolvedQuery = (
    data: unknown,
    newestRow: unknown = null,
  ): Record<string, unknown> => {
    const query: Record<string, unknown> = {
      url: new URL("https://supabase.test/rest/v1/table"),
      then: (resolve: (result: { data: unknown; error: null }) => void) =>
        resolve({ data, error: null }),
    };
    for (const method of ["select", "eq", "in", "not", "is", "limit", "range"])
      query[method] = () => query;
    query.order = (column: string) => {
      (query.url as URL).searchParams.set("order", column);
      return query;
    };
    query.maybeSingle = () => resolvedQuery(newestRow);
    return query;
  };

  type UpsertConcepts = ReturnType<typeof fakeRpc>;

  const givenDatabase = ({
    lastSynced,
    directTitles = {},
    conceptIds = [],
  }: {
    lastSynced?: string;
    directTitles?: Record<string, string>;
    conceptIds?: string[];
  } = {}): UpsertConcepts => {
    const upsertConcepts = fakeRpc(({ data }) => ({
      data: data.map((_, i) => i + 1),
      error: null,
    }));
    const titleRows = Object.entries(directTitles).map(
      ([source_local_id, text]) => ({ source_local_id, text }),
    );
    vi.mocked(getLoggedInClient).mockResolvedValue({
      from: (table: string) =>
        resolvedQuery(
          table === "my_contents" ? titleRows : [],
          lastSynced ? { last_modified: lastSynced } : null,
        ),
      rpc: (name: string, args: RpcArgs & { rid?: string }) => {
        if (name === "upsert_concepts") return upsertConcepts(name, args);
        if (name === "rid_or_local_id_to_concept_db_id")
          return Promise.resolve({
            data: conceptIds.includes(args.rid ?? "") ? 1 : null,
            error: null,
          });
        throw new Error(`Unexpected rpc ${name}`);
      },
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    } as unknown as DGSupabaseClient);
    return upsertConcepts;
  };

  const givenVault = ({
    notes,
    relations = [],
  }: {
    notes: DiscourseNodeInVault[];
    relations?: RelationInstance[];
  }): DiscourseGraphPlugin => {
    vi.mocked(collectDiscourseNodesFromVault).mockResolvedValue(notes);
    const relationsFile = Object.assign(new TFile(), {
      path: getRelationsFilePath(),
    });
    const textByPath: Record<string, string> = {
      ...TEXT_BY_PATH,
      [relationsFile.path]: JSON.stringify({
        version: 1,
        lastModified: 0,
        relations: Object.fromEntries(relations.map((r) => [r.id, r])),
      }),
    };
    const files = [
      ...notes.map(({ file }) => file),
      TEMPLATE_FILE,
      relationsFile,
    ];
    return {
      settings: {
        accountLocalId: ACCOUNT_LOCAL_ID,
        nodeTypes: [CLAIM_TYPE, SOURCE_TYPE, IMPORTED_EVIDENCE_TYPE],
        relationTypes: [CITES_TYPE, SUPPORTS_TYPE, IMPORTED_OPPOSES_TYPE],
        discourseRelations: [
          CLAIM_CITES_SOURCE,
          CLAIM_SUPPORTS_CLAIM,
          IMPORTED_CLAIM_OPPOSES_CLAIM,
        ],
      },
      app: {
        vault: {
          getAbstractFileByPath: (path: string) =>
            files.find((file) => file.path === path) ?? null,
          read: (file: TFile) => Promise.resolve(textByPath[file.path]),
        },
        metadataCache: {
          getFileCache: (file: TFile) => ({
            frontmatter: notes.find((n) => n.file.path === file.path)
              ?.frontmatter,
          }),
        },
        internalPlugins: {
          plugins: {
            templates: {
              enabled: true,
              instance: { options: { folder: "Templates" } },
            },
          },
        },
      },
    } as unknown as DiscourseGraphPlugin;
  };

  // What supabase-js sends to upsert_concepts: JSON, so undefined fields drop out.
  // upsert_concepts stores these alike, so changing only these changes no stored
  // value: a row's space_id (it sets every row's space_id from v_space_id), a
  // missing literal_content (it defaults to {}), ".000" or a trailing "Z" in a UTC
  // timestamp (Concept and Content timestamps are timestamp without time zone,
  // which ignores the zone), and author_id versus an author_local_id naming the
  // same account (_local_concept_to_db_concept resolves it).
  const sentConcepts = (
    upsertConcepts: UpsertConcepts,
  ): LocalConceptDataInput[] =>
    upsertConcepts.mock.calls.flatMap(([, { data, v_space_id }]) => {
      expect(v_space_id, "v_space_id").toBe(SPACE_ID);
      return JSON.parse(JSON.stringify(data)) as LocalConceptDataInput[];
    });

  beforeEach(() => {
    vi.mocked(getSupabaseContext).mockResolvedValue({
      spaceId: SPACE_ID,
      userId: USER_ID,
    } as Awaited<ReturnType<typeof getSupabaseContext>>);
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      const { input } = JSON.parse(init.body as string) as { input: string[] };
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: input.map((text) => ({ embedding: embeddingOf(text) })),
          }),
      });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("on a full sync into an empty space", () => {
    let sent: LocalConceptDataInput[];
    const sentRow = (
      sourceLocalId: string,
    ): LocalConceptDataInput | undefined =>
      sent.find((concept) => concept.source_local_id === sourceLocalId);

    beforeEach(async () => {
      const upsertConcepts = givenDatabase();
      await syncAllNodesAndRelations(
        givenVault({
          notes: [claimNote(), SOURCE_NOTE, IMPORTED_NOTE],
          relations: [
            CLAIM_CITES_WALKER,
            CLAIM_SUPPORTS_IMPORTED,
            IMPORTED_RELATION,
          ],
        }),
      );
      sent = sentConcepts(upsertConcepts);
    });

    it("sends every node type, every local or accepted imported relation schema, and every local note and relation, but no imported note or relation", () => {
      expect(sent.map((concept) => concept.source_local_id).sort()).toEqual(
        [
          "claim-type",
          "source-type",
          "evidence-type",
          "cites-type",
          "supports-type",
          "opposes-type",
          "claim-cites-source",
          "claim-supports-claim",
          "claim-opposes-claim",
          "claim-node",
          "source-node",
          "rel-cites",
          "rel-supports-imported",
        ].sort(),
      );
    });

    it("sends a node type as a schema Concept with its format, settings and template", () => {
      expect(sentRow("claim-type")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "claim-type",
        is_schema: true,
        author_id: USER_ID,
        name: "Claim",
        description: "An assertion that evidence can support",
        created: SCHEMA_CREATED,
        last_modified: SCHEMA_MODIFIED,
        literal_content: {
          label: "Claim",
          format: "CLM - {content}",
          template: "Claim template",
          template_content: "## Evidence\n",
          source_data: {
            color: "#7DA13E",
            tag: "clm",
            shortcut: "C",
            keyImage: true,
            folderPath: "Claims",
          },
        },
      });
    });

    it("sends template_content null for a node type with no template", () => {
      expect(sentRow("source-type")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "source-type",
        is_schema: true,
        author_id: USER_ID,
        name: "Source",
        created: SCHEMA_CREATED,
        last_modified: SCHEMA_MODIFIED,
        literal_content: {
          label: "Source",
          format: "SRC - {content}",
          template_content: null,
          source_data: {},
        },
      });
    });

    it("sends an imported node type with its origin RID, authored by this space's user", () => {
      expect(sentRow("evidence-type")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "evidence-type",
        is_schema: true,
        author_id: USER_ID,
        name: "Evidence",
        created: SCHEMA_CREATED,
        last_modified: SCHEMA_MODIFIED,
        literal_content: {
          label: "Evidence",
          format: "EVD - {content}",
          template_content: null,
          importedFromRid: "orn:obsidian.schema:other-vault/evidence-type",
          source_data: { authorId: 9 },
        },
      });
    });

    it("sends a relation type as a schema Concept named by its label", () => {
      expect(sentRow("cites-type")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "cites-type",
        is_schema: true,
        author_id: USER_ID,
        name: "cites",
        created: SCHEMA_CREATED,
        last_modified: SCHEMA_MODIFIED,
        literal_content: {
          roles: ["source", "destination"],
          label: "cites",
          complement: "is cited by",
          source_data: { color: "blue" },
        },
      });
    });

    it("sends an accepted imported relation type with its origin RID and without its status", () => {
      expect(sentRow("opposes-type")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "opposes-type",
        is_schema: true,
        author_id: USER_ID,
        name: "opposes",
        created: SCHEMA_CREATED,
        last_modified: SCHEMA_MODIFIED,
        literal_content: {
          roles: ["source", "destination"],
          label: "opposes",
          complement: "is opposed by",
          importedFromRid: "orn:obsidian.schema:other-vault/opposes-type",
          source_data: { color: "red", authorId: 9 },
        },
      });
    });

    it("names a relation triple '<source type> -<label>-> <destination type>' and references its types", () => {
      expect(sentRow("claim-cites-source")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "claim-cites-source",
        is_schema: true,
        author_id: USER_ID,
        name: "Claim -cites-> Source",
        created: SCHEMA_CREATED,
        last_modified: SCHEMA_MODIFIED,
        literal_content: {
          roles: ["source", "destination"],
          label: "cites",
          complement: "is cited by",
        },
        local_reference_content: {
          relation_type: "cites-type",
          source: "claim-type",
          destination: "source-type",
        },
      });
    });

    it("sends an accepted imported relation triple with its origin RID", () => {
      expect(sentRow("claim-opposes-claim")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "claim-opposes-claim",
        is_schema: true,
        author_id: USER_ID,
        name: "Claim -opposes-> Claim",
        created: SCHEMA_CREATED,
        last_modified: SCHEMA_MODIFIED,
        literal_content: {
          roles: ["source", "destination"],
          label: "opposes",
          complement: "is opposed by",
          importedFromRid:
            "orn:obsidian.schema:other-vault/claim-opposes-claim",
        },
        local_reference_content: {
          relation_type: "opposes-type",
          source: "claim-type",
          destination: "claim-type",
        },
      });
    });

    it("sends a new note as a Concept named by its file path, with its title as direct Content and its text as full Content", () => {
      expect(sentRow("claim-node")).toStrictEqual({
        ...CLAIM_CONCEPT,
        local_reference_content: { sourceDocument: "source-node" },
        contents_inline: [CLAIM_DIRECT_CONTENT, CLAIM_FULL_CONTENT],
      });
    });

    it("sends a note with no Source and no extra frontmatter without a sourceDocument and with an empty source_data", () => {
      expect(sentRow("source-node")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "source-node",
        schema_represented_by_local_id: "source-type",
        is_schema: false,
        author_id: USER_ID,
        name: "Sources/SRC - Walker 2017.md",
        created: NOTE_CREATED,
        last_modified: NOTE_MODIFIED,
        literal_content: {
          label: "SRC - Walker 2017",
          core_title: "Walker 2017",
          source_data: {},
        },
        contents_inline: [
          {
            source_local_id: "source-node",
            author_local_id: ACCOUNT_LOCAL_ID,
            creator_local_id: ACCOUNT_LOCAL_ID,
            scale: "document",
            created: NOTE_CREATED,
            last_modified: NOTE_MODIFIED,
            variant: "direct",
            content_type: "text/plain",
            text: "SRC - Walker 2017",
            metadata: { filePath: "Sources/SRC - Walker 2017.md" },
            embedding_inline: {
              model: "openai_text_embedding_3_small_1536",
              vector: embeddingOf("SRC - Walker 2017"),
            },
          },
          {
            source_local_id: "source-node",
            author_local_id: ACCOUNT_LOCAL_ID,
            creator_local_id: ACCOUNT_LOCAL_ID,
            scale: "document",
            created: NOTE_CREATED,
            last_modified: NOTE_MODIFIED,
            variant: "full",
            content_type: "text/obsidian+markdown",
            text: "Walker, M. (2017). Why we sleep.",
            metadata: {
              nodeTypeId: "source-type",
              nodeInstanceId: "source-node",
            },
          },
        ],
      });
    });

    it("sends a Source before the note that cites it", () => {
      const ids = sent.map((concept) => concept.source_local_id);
      expect(ids.indexOf("source-node")).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf("claim-node")).toBeGreaterThan(
        ids.indexOf("source-node"),
      );
    });

    it("sends a relation as a Concept between its notes' ids, named by their titles", () => {
      expect(sentRow("rel-cites")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "rel-cites",
        schema_represented_by_local_id: "cites-type",
        is_schema: false,
        author_id: USER_ID,
        name: "[[CLM - Sleep consolidates memory]] -cites-> [[SRC - Walker 2017]]",
        created: RELATION_CREATED,
        last_modified: RELATION_MODIFIED,
        literal_content: {},
        local_reference_content: {
          source: "claim-node",
          destination: "source-node",
        },
      });
    });

    it("points a relation at an imported note by the note's origin RID", () => {
      expect(sentRow("rel-supports-imported")).toStrictEqual({
        space_id: SPACE_ID,
        source_local_id: "rel-supports-imported",
        schema_represented_by_local_id: "supports-type",
        is_schema: false,
        author_id: USER_ID,
        name: "[[CLM - Sleep consolidates memory]] -supports-> [[CLM - Dreams replay the day]]",
        created: RELATION_CREATED,
        last_modified: RELATION_MODIFIED,
        literal_content: {},
        local_reference_content: {
          source: "claim-node",
          destination: IMPORTED_CLAIM_RID,
        },
      });
    });
  });

  describe("on a file change in a space already synced", () => {
    it("sends only the full Content when a note's text changes", async () => {
      const upsertConcepts = givenDatabase({
        lastSynced: LAST_SYNCED,
        directTitles: { "claim-node": "CLM - Sleep consolidates memory" },
      });
      const plugin = givenVault({ notes: [claimNote(NOTE_EDITED)] });

      await syncDiscourseNodeChanges(
        plugin,
        new Map([[CLAIM_PATH, ["content"]]]),
      );

      expect(sentConcepts(upsertConcepts)).toStrictEqual([
        {
          ...CLAIM_CONCEPT,
          last_modified: NOTE_EDITED,
          contents_inline: [
            { ...CLAIM_FULL_CONTENT, last_modified: NOTE_EDITED },
          ],
        },
      ]);
    });

    it("sends only the direct Content when a note is renamed", async () => {
      const upsertConcepts = givenDatabase({
        lastSynced: LAST_SYNCED,
        directTitles: { "claim-node": "CLM - Sleep helps memory" },
      });
      const plugin = givenVault({ notes: [claimNote()] });

      await syncDiscourseNodeChanges(
        plugin,
        new Map([[CLAIM_PATH, ["title"]]]),
      );

      expect(sentConcepts(upsertConcepts)).toStrictEqual([
        { ...CLAIM_CONCEPT, contents_inline: [CLAIM_DIRECT_CONTENT] },
      ]);
    });

    it("keeps a note's Source when the Source is already in the database", async () => {
      const upsertConcepts = givenDatabase({
        lastSynced: LAST_SYNCED,
        directTitles: { "claim-node": "CLM - Sleep consolidates memory" },
        conceptIds: ["source-node"],
      });
      const plugin = givenVault({
        notes: [claimNote(NOTE_EDITED), SOURCE_NOTE],
        relations: [CLAIM_CITES_WALKER],
      });

      await syncDiscourseNodeChanges(
        plugin,
        new Map([[CLAIM_PATH, ["content"]]]),
      );

      expect(sentConcepts(upsertConcepts)).toStrictEqual([
        {
          ...CLAIM_CONCEPT,
          last_modified: NOTE_EDITED,
          local_reference_content: { sourceDocument: "source-node" },
          contents_inline: [
            { ...CLAIM_FULL_CONTENT, last_modified: NOTE_EDITED },
          ],
        },
      ]);
    });

    it("sends nothing when an imported note changes", async () => {
      const upsertConcepts = givenDatabase({ lastSynced: LAST_SYNCED });
      const plugin = givenVault({ notes: [IMPORTED_NOTE] });

      await syncDiscourseNodeChanges(
        plugin,
        new Map([[IMPORTED_NOTE.file.path, ["title", "content"]]]),
      );

      expect(upsertConcepts).not.toHaveBeenCalled();
    });
  });
});
