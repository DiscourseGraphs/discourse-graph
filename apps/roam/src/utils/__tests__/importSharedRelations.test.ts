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

vi.hoisted(() => {
  vi.stubGlobal("window", { roamAlphaAPI: { graph: { name: "local" } } });
});
vi.mock("~/utils/refreshConfigTree", () => ({ default: vi.fn() }));
vi.mock("~/utils/getDiscourseRelations", () => ({ default: vi.fn() }));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [{ type: "local-claim", text: "Claim" }],
}));
vi.mock("~/utils/importedSourceIdentity", () => ({
  getImportedSourceRids: () => Promise.resolve(new Set<string>()),
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
  getReifiedRelations: () => Promise.resolve([]),
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
    await expect(importSharedRelations(client, 7)).resolves.toBeUndefined();
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
