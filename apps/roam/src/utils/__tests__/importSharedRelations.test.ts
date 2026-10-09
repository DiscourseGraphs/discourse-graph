import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { DiscourseRelation } from "~/utils/getDiscourseRelations";
import { importSharedRelations } from "~/utils/importSharedRelations";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { writeImportedSourceIdentity } from "~/utils/importedSourceIdentity";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import { createRelationSchema } from "~/utils/createRelationSchema";
import { createDiscourseNodeType } from "~/components/settings/utils/accessors";
import { discoverSharedRelations } from "~/utils/discoverSharedRelations";
import type { DiscoverSharedRelationsResult } from "~/utils/discoverSharedRelations";
import {
  findImportedNodeUidBySourceRid,
  getImportedSourceRids,
} from "~/utils/importedSourceIdentity";
import { createReifiedRelation } from "~/utils/createReifiedBlock";
import findDiscourseNode from "~/utils/findDiscourseNode";
import internalError from "~/utils/internalError";

vi.hoisted(() => {
  vi.stubGlobal("window", { roamAlphaAPI: { graph: { name: "local" } } });
});
vi.mock("~/utils/refreshConfigTree", () => ({ default: vi.fn() }));
vi.mock("~/utils/getDiscourseRelations", () => ({ default: vi.fn() }));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [{ type: "local-claim", text: "Claim" }],
}));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("~/utils/findTargetUid", () => ({
  findTargetUid: (localOrRid: string) => Promise.resolve(`page-${localOrRid}`),
}));
vi.mock("~/utils/findDiscourseNode", () => ({ default: vi.fn() }));
vi.mock("~/utils/importedSourceIdentity", () => ({
  getImportedSourceRids: vi.fn(() => Promise.resolve(new Set<string>())),
  findImportedNodeUidBySourceRid: vi.fn(),
  writeImportedSourceIdentity: vi.fn(),
}));
vi.mock("~/components/settings/utils/accessors", () => ({
  createDiscourseNodeType: vi.fn(),
}));
vi.mock("~/utils/createRelationSchema", () => ({
  createRelationSchema: vi.fn(),
}));
vi.mock("~/utils/createReifiedBlock", () => ({
  getReifiedRelations: vi.fn(() => Promise.resolve([])),
  createReifiedRelation: vi.fn(),
}));
vi.mock("roamjs-components/writes", () => ({ deleteBlock: vi.fn() }));
vi.mock("~/utils/discoverSharedRelations", () => ({
  discoverSharedRelations: vi.fn(() =>
    Promise.resolve({
      relations: [],
      relTypeSchemas: [],
      nodeSchemas: [
        {
          localId: "claim",
          rid: "orn:obsidian.schema:remote/claim",
          label: "Claim",
          authorId: "author",
          createdAt: new Date("2026-09-07"),
        },
      ],
      relTripleSchemas: [
        {
          localId: "supports",
          rid: "orn:obsidian.schema:remote/supports",
          label: "Supports",
          complement: "Supported by",
          sourceType: "claim",
          destinationType: "claim",
          authorId: "author",
          createdAt: new Date("2026-09-07"),
        },
      ],
      tripleCandidatesByRelationType: {},
      matchedTripleByRelation: {},
      skippedRelations: [],
    }),
  ),
}));

const relation = (id: string): DiscourseRelation => ({
  id,
  label: "Supports",
  complement: "Supported by",
  source: "local-claim",
  destination: "local-claim",
  triples: [],
});
const client = {} as DGSupabaseClient;

beforeEach(() => vi.clearAllMocks());

describe("importSharedRelations schema matching", () => {
  it("refreshes the grammar after storing a new schema and its provenance", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([]);
    vi.mocked(createRelationSchema).mockResolvedValue("imported-supports");
    await importSharedRelations(client, 7);
    expect(writeImportedSourceIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        pageUid: "imported-supports",
        sourceNodeRid: "orn:obsidian.schema:remote/supports",
      }),
    );
    expect(refreshConfigTree).toHaveBeenCalledOnce();
    expect(
      vi.mocked(refreshConfigTree).mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      vi.mocked(writeImportedSourceIdentity).mock.invocationCallOrder[0],
    );
  });
  it("reuses one schema when its query patterns produce multiple matches", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([
      {
        ...relation("local-supports"),
        triples: [["source", "references", "destination"]],
      },
      {
        ...relation("local-supports"),
        triples: [["source", "is in page", "destination"]],
      },
    ]);
    await expect(importSharedRelations(client, 7)).resolves.toEqual({
      failures: [],
      skipped: [],
    });
    expect(createRelationSchema).not.toHaveBeenCalled();
  });

  it("rejects matches to two different schemas", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([
      relation("supports-one"),
      relation("supports-two"),
    ]);
    await expect(importSharedRelations(client, 7)).rejects.toThrow(
      "multiple matches",
    );
    expect(createRelationSchema).not.toHaveBeenCalled();
  });

  it("creates a missing node type with its template prepared as node import does", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([]);
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce({
      relations: [],
      relTypeSchemas: [],
      relTripleSchemas: [],
      tripleCandidatesByRelationType: {},
      matchedTripleByRelation: {},
      skippedRelations: [],
      nodeSchemas: [
        {
          localId: "evidence",
          rid: "orn:obsidian.schema:remote/evidence",
          label: "Evidence",
          template: "---\ntags: evidence\n---\n## Source\n",
          authorId: "author",
          createdAt: new Date("2026-09-07"),
        },
        {
          localId: "question",
          rid: "orn:obsidian.schema:remote/question",
          label: "Question",
          template: "\n\n",
          authorId: "author",
          createdAt: new Date("2026-09-07"),
        },
      ],
    });
    vi.mocked(createDiscourseNodeType).mockImplementation(({ label }) =>
      Promise.resolve({
        text: label,
        type: `imported-${label}`,
        shortcut: "",
        format: "",
        specification: [],
        backedBy: "user",
        canvasSettings: {},
      }),
    );

    await importSharedRelations(client, 7);

    expect(createDiscourseNodeType).toHaveBeenCalledWith({
      label: "Evidence",
      template: "## Source\n",
    });
    expect(createDiscourseNodeType).toHaveBeenCalledWith({
      label: "Question",
      template: undefined,
    });
  });
});

describe("importSharedRelations for relations that point to a relation type", () => {
  const relationTypeRid = "orn:obsidian.schema:remote/rel-supports";
  const tripleRid = "orn:obsidian.schema:remote/claim-supports-evidence";
  const relationRid = (localId: string) =>
    `orn:obsidian.relation:remote/${localId}`;
  const crossSpaceRelation = (localId: string) => ({
    rid: relationRid(localId),
    localId,
    authorId: "author",
    createdAt: new Date("2026-10-01"),
    relationType: "rel-supports",
    source: `x-${localId}`,
    destination: `y-${localId}`,
  });
  const discovered = (
    overrides: Partial<DiscoverSharedRelationsResult> = {},
  ): DiscoverSharedRelationsResult => ({
    relations: [crossSpaceRelation("one")],
    relTypeSchemas: [
      {
        localId: "rel-supports",
        rid: relationTypeRid,
        label: "Supports",
        complement: "Supported by",
        authorId: "author",
        createdAt: new Date("2026-10-01"),
      },
    ],
    relTripleSchemas: [],
    nodeSchemas: [],
    tripleCandidatesByRelationType: {
      [relationTypeRid]: [
        {
          rid: tripleRid,
          label: "Supports",
          complement: "Is supported by",
          modifiedAt: new Date("2026-10-02"),
        },
      ],
    },
    matchedTripleByRelation: {},
    skippedRelations: [],
    ...overrides,
  });
  const localTriple = (id: string, label = "Supports"): DiscourseRelation => ({
    id,
    label,
    complement: "Supported by",
    source: "local-claim",
    destination: "local-evidence",
    triples: [],
  });

  beforeEach(() => {
    vi.mocked(findDiscourseNode).mockImplementation(({ uid }) =>
      uid.startsWith("page-x")
        ? ({ type: "local-claim" } as ReturnType<typeof findDiscourseNode>)
        : ({ type: "local-evidence" } as ReturnType<typeof findDiscourseNode>),
    );
    vi.mocked(createReifiedRelation).mockResolvedValue("new-relation");
    vi.mocked(getImportedSourceRids).mockResolvedValue(new Set());
    vi.mocked(findImportedNodeUidBySourceRid).mockResolvedValue(null);
  });

  it("uses the local triple that fits the pages' node types", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([
      localTriple("local-supports"),
    ]);
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce(
      discovered({
        matchedTripleByRelation: { [relationRid("one")]: tripleRid },
      }),
    );

    await expect(importSharedRelations(client, 7)).resolves.toEqual({
      failures: [],
      skipped: [],
    });

    expect(createRelationSchema).not.toHaveBeenCalled();
    expect(createReifiedRelation).toHaveBeenCalledWith({
      sourceUid: "page-x-one",
      destinationUid: "page-y-one",
      relationBlockUid: "local-supports",
      tentative: true,
    });
  });

  it("finds a triple imported earlier and renamed locally by its source identity", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([
      localTriple("renamed-supports", "Backs"),
    ]);
    vi.mocked(getImportedSourceRids).mockResolvedValue(new Set([tripleRid]));
    vi.mocked(findImportedNodeUidBySourceRid).mockResolvedValue(
      "renamed-supports",
    );
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce(discovered());

    await importSharedRelations(client, 7);

    expect(createRelationSchema).not.toHaveBeenCalled();
    expect(createReifiedRelation).toHaveBeenCalledWith(
      expect.objectContaining({ relationBlockUid: "renamed-supports" }),
    );
  });

  it("imports the matched triple with the pages' node types as its ends", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([]);
    vi.mocked(createRelationSchema).mockResolvedValue("imported-supports");
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce(
      discovered({
        matchedTripleByRelation: { [relationRid("one")]: tripleRid },
      }),
    );

    await importSharedRelations(client, 7);

    expect(createRelationSchema).toHaveBeenCalledWith({
      label: "Supports",
      complement: "Is supported by",
      source: "local-claim",
      destination: "local-evidence",
      triples: [],
    });
    expect(writeImportedSourceIdentity).toHaveBeenCalledWith({
      pageUid: "imported-supports",
      sourceNodeRid: tripleRid,
      sourceModifiedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(createReifiedRelation).toHaveBeenCalledWith(
      expect.objectContaining({ relationBlockUid: "imported-supports" }),
    );
  });

  it("does not give a second triple the source RID of an imported copy that does not fit", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([
      { ...localTriple("imported-elsewhere"), source: "local-question" },
    ]);
    vi.mocked(getImportedSourceRids).mockResolvedValue(new Set([tripleRid]));
    vi.mocked(findImportedNodeUidBySourceRid).mockResolvedValue(
      "imported-elsewhere",
    );
    vi.mocked(createRelationSchema).mockResolvedValue("second-supports");
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce(
      discovered({
        matchedTripleByRelation: { [relationRid("one")]: tripleRid },
      }),
    );

    await importSharedRelations(client, 7);

    expect(createRelationSchema).toHaveBeenCalledWith(
      expect.objectContaining({ complement: "Is supported by" }),
    );
    expect(writeImportedSourceIdentity).not.toHaveBeenCalledWith(
      expect.objectContaining({ pageUid: "second-supports" }),
    );
    expect(createReifiedRelation).toHaveBeenCalledWith(
      expect.objectContaining({ relationBlockUid: "second-supports" }),
    );
  });

  it("creates a triple with no source identity when no candidate matched", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([]);
    vi.mocked(createRelationSchema).mockResolvedValue("created-supports");
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce(discovered());

    await importSharedRelations(client, 7);

    expect(createRelationSchema).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Supports",
        complement: "Supported by",
      }),
    );
    expect(writeImportedSourceIdentity).not.toHaveBeenCalledWith(
      expect.objectContaining({ pageUid: "created-supports" }),
    );
  });

  it("creates the triple once for several relations that need it", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([]);
    vi.mocked(createRelationSchema).mockResolvedValue("created-supports");
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce(
      discovered({
        relations: [crossSpaceRelation("one"), crossSpaceRelation("two")],
      }),
    );

    await importSharedRelations(client, 7);

    expect(createRelationSchema).toHaveBeenCalledOnce();
    expect(createReifiedRelation).toHaveBeenCalledTimes(2);
  });

  it("reports relations skipped for a hidden schema and imports the rest", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([
      localTriple("local-supports"),
    ]);
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce(
      discovered({
        skippedRelations: ["hidden: its relation type is not visible"],
      }),
    );

    const result = await importSharedRelations(client, 7);

    expect(result).toEqual({
      failures: [],
      skipped: ["hidden: its relation type is not visible"],
    });
    expect(createReifiedRelation).toHaveBeenCalledOnce();
    expect(internalError).not.toHaveBeenCalled();
  });

  it("imports the relations after one that fails", async () => {
    vi.mocked(getDiscourseRelations).mockReturnValue([
      localTriple("local-supports"),
    ]);
    vi.mocked(discoverSharedRelations).mockResolvedValueOnce(
      discovered({
        relations: [
          { ...crossSpaceRelation("broken"), relationType: "unknown" },
          crossSpaceRelation("two"),
        ],
      }),
    );

    const { failures } = await importSharedRelations(client, 7);

    expect(failures).toEqual([
      `${relationRid("broken")}: Missing relation type: unknown`,
    ]);
    expect(createReifiedRelation).toHaveBeenCalledOnce();
    expect(createReifiedRelation).toHaveBeenCalledWith(
      expect.objectContaining({ sourceUid: "page-x-two" }),
    );
    expect(internalError).toHaveBeenCalledOnce();
  });
});
