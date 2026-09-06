import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { DiscourseRelation } from "~/utils/getDiscourseRelations";
import { importSharedRelations } from "~/utils/importSharedRelations";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import { createRelationSchema } from "~/utils/createRelationSchema";

vi.hoisted(() => {
  vi.stubGlobal("window", { roamAlphaAPI: { graph: { name: "local" } } });
});
vi.mock("~/utils/getDiscourseRelations", () => ({ default: vi.fn() }));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [{ type: "local-claim", text: "Claim" }],
}));
vi.mock("~/utils/importedSourceIdentity", () => ({
  getImportedSourceRids: async () => new Set<string>(),
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
  getReifiedRelations: async () => [],
  createReifiedRelation: vi.fn(),
}));
vi.mock("roamjs-components/writes", () => ({ deleteBlock: vi.fn() }));
vi.mock("~/utils/discoverSharedRelations", () => ({
  discoverSharedRelations: async () => ({
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
});
