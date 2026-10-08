import { describe, expect, it } from "vitest";
import type { DiscourseRelation } from "~/types";
import { findTriplesWithRelationRid } from "~/utils/repairTripleRids";

const triple = (id: string, importedFromRid?: string): DiscourseRelation => ({
  id,
  sourceId: "clm",
  destinationId: "evd",
  relationshipTypeId: "sup",
  created: 0,
  modified: 0,
  importedFromRid,
});

describe("findTriplesWithRelationRid", () => {
  it("finds a triple whose RID has the relation subtype", () => {
    const bad = triple("t1", "orn:obsidian.relation:vault-a/rel-1");
    expect(findTriplesWithRelationRid([bad], new Set())).toEqual([bad]);
  });

  it("finds a triple whose RID is an imported relation instance's", () => {
    const roamRid = "https://roamresearch.com/#/app/graph/page/relUid";
    const bad = triple("t1", roamRid);
    expect(findTriplesWithRelationRid([bad], new Set([roamRid]))).toEqual([
      bad,
    ]);
  });

  it("leaves local triples and triples with a schema RID alone", () => {
    expect(
      findTriplesWithRelationRid(
        [
          triple("t1"),
          triple("t2", "orn:obsidian.schema:vault-a/triple-1"),
          triple("t3", "https://roamresearch.com/#/app/graph/page/tripleUid"),
        ],
        new Set(["orn:obsidian.relation:vault-a/other"]),
      ),
    ).toEqual([]);
  });
});
