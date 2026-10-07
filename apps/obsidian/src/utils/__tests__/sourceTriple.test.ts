import { describe, expect, it } from "vitest";
import type { RemoteRelationInstance } from "~/utils/importRelations";
import { type SchemaRow, selectSourceTripleRids } from "~/utils/sourceTriple";

const A = 10;
const B = 20;
const spaceUriById = new Map([
  [A, "obsidian:vault-a"],
  [B, "obsidian:vault-b"],
]);

const schema = (
  row: Pick<SchemaRow, "id" | "space_id" | "source_local_id" | "name"> &
    Partial<SchemaRow>,
): SchemaRow => ({ literal_content: {}, reference_content: {}, ...row });

const claim = schema({
  id: 1,
  space_id: A,
  source_local_id: "clm",
  name: "Claim",
});
const evidenceA = schema({
  id: 2,
  space_id: A,
  source_local_id: "evd-a",
  name: "Evidence",
  literal_content: { importedFromRid: "orn:obsidian.schema:vault-b/evd-b" },
});
const evidenceB = schema({
  id: 3,
  space_id: B,
  source_local_id: "evd-b",
  name: "Evidence",
});
const supports = schema({
  id: 4,
  space_id: A,
  source_local_id: "sup",
  name: "Supports",
  literal_content: { label: "supports" },
});
const triple = (id: number, localId: string, refs: Record<string, number>) =>
  schema({
    id,
    space_id: A,
    source_local_id: localId,
    name: "Claim -supports-> Evidence",
    reference_content: { relation_type: supports.id, ...refs },
  });

// X is A's own claim; Y is B's evidence node, which A imported.
const relation = (schemaId: number): RemoteRelationInstance => ({
  id: 100,
  source_local_id: "rel-1",
  schema_id: schemaId,
  reference_content: { source: 50, destination: 60 },
  refs: [50, 60],
  created: null,
  last_modified: null,
  author_id: null,
  concepts_of_relation: [
    { id: 50, space_id: A, source_local_id: "x", schema_id: claim.id },
    { id: 60, space_id: B, source_local_id: "y", schema_id: evidenceB.id },
  ],
});

const byId = (...rows: SchemaRow[]) => new Map(rows.map((r) => [r.id, r]));

describe("selectSourceTripleRids", () => {
  it("uses the schema itself when the relation's schema is a triple", () => {
    const roamTriple = triple(5, "roam-triple", { source: 1, destination: 3 });
    expect(
      selectSourceTripleRids({
        relations: [relation(roamTriple.id)],
        schemasById: byId(roamTriple, claim, evidenceB),
        candidateTriples: [],
        spaceUriById,
      }),
    ).toEqual(new Map([[100, "orn:obsidian.schema:vault-a/roam-triple"]]));
  });

  it("picks the relation space's triple whose ends match the relation's end types", () => {
    const fits = triple(5, "t-fits", { source: 1, destination: 2 });
    const other = triple(6, "t-other", { source: 1, destination: 1 });
    expect(
      selectSourceTripleRids({
        relations: [relation(supports.id)],
        schemasById: byId(supports, claim, evidenceA, evidenceB),
        candidateTriples: [fits, other],
        spaceUriById,
      }),
    ).toEqual(new Map([[100, "orn:obsidian.schema:vault-a/t-fits"]]));
  });

  it("matches a hidden end type by the name in the triple's name", () => {
    const hiddenEnd = triple(5, "t-hidden", { source: 1, destination: 2 });
    expect(
      selectSourceTripleRids({
        relations: [relation(supports.id)],
        schemasById: byId(supports, claim, evidenceB),
        candidateTriples: [hiddenEnd],
        spaceUriById,
      }),
    ).toEqual(new Map([[100, "orn:obsidian.schema:vault-a/t-hidden"]]));
  });

  it("ignores triples from other spaces", () => {
    const elsewhere = {
      ...triple(5, "t-b", { source: 1, destination: 3 }),
      space_id: B,
    };
    expect(
      selectSourceTripleRids({
        relations: [relation(supports.id)],
        schemasById: byId(supports, claim, evidenceB),
        candidateTriples: [elsewhere],
        spaceUriById,
      }).size,
    ).toBe(0);
  });

  it("records nothing when two triples match equally", () => {
    expect(
      selectSourceTripleRids({
        relations: [relation(supports.id)],
        schemasById: byId(supports, claim, evidenceB),
        candidateTriples: [
          triple(5, "t-one", { source: 1, destination: 90 }),
          triple(6, "t-two", { source: 1, destination: 91 }),
        ],
        spaceUriById,
      }).size,
    ).toBe(0);
  });

  it("records nothing when the relation's schema is not visible", () => {
    expect(
      selectSourceTripleRids({
        relations: [relation(supports.id)],
        schemasById: byId(claim, evidenceB),
        candidateTriples: [triple(5, "t", { source: 1, destination: 2 })],
        spaceUriById,
      }).size,
    ).toBe(0);
  });
});
