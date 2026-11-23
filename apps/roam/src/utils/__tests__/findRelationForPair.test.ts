import { describe, expect, it } from "vitest";
import { findRelationForPair } from "~/utils/findRelationForPair";

const evidenceSupportsClaim = {
  id: "t1",
  source: "evidence",
  destination: "claim",
};
const claimSupportsEvidence = {
  id: "t2",
  source: "claim",
  destination: "evidence",
};

describe("findRelationForPair", () => {
  it("keeps the arrow's own triplet when a same-label triplet runs the other way", () => {
    const result = findRelationForPair({
      relations: [evidenceSupportsClaim, claimSupportsEvidence],
      sourceNodeType: "claim",
      targetNodeType: "evidence",
      preferredRelationId: "t2",
    });
    expect(result).toEqual({
      isDirect: true,
      isReverse: false,
      matchingRelation: claimSupportsEvidence,
    });
  });

  it("keeps the arrow's own triplet when same-label triplets differ by complement", () => {
    const isSupportedBy = { ...evidenceSupportsClaim, id: "a" };
    const backs = { ...evidenceSupportsClaim, id: "b" };
    const result = findRelationForPair({
      relations: [isSupportedBy, backs],
      sourceNodeType: "evidence",
      targetNodeType: "claim",
      preferredRelationId: "b",
    });
    expect(result.matchingRelation).toBe(backs);
  });

  it("keeps the arrow's own triplet in reverse when it fits the pair that way", () => {
    const result = findRelationForPair({
      relations: [evidenceSupportsClaim, claimSupportsEvidence],
      sourceNodeType: "evidence",
      targetNodeType: "claim",
      preferredRelationId: "t2",
    });
    expect(result).toEqual({
      isDirect: false,
      isReverse: true,
      matchingRelation: claimSupportsEvidence,
    });
  });

  it("falls back to the first match when the preferred triplet does not fit the pair", () => {
    const questionSupportsClaim = {
      id: "t3",
      source: "question",
      destination: "claim",
    };
    const result = findRelationForPair({
      relations: [questionSupportsClaim, evidenceSupportsClaim],
      sourceNodeType: "evidence",
      targetNodeType: "claim",
      preferredRelationId: "t3",
    });
    expect(result.matchingRelation).toBe(evidenceSupportsClaim);
  });

  it("falls back to the first match when the preferred id is not in the label group", () => {
    const result = findRelationForPair({
      relations: [evidenceSupportsClaim],
      sourceNodeType: "claim",
      targetNodeType: "evidence",
      preferredRelationId: "missing",
    });
    expect(result).toEqual({
      isDirect: false,
      isReverse: true,
      matchingRelation: evidenceSupportsClaim,
    });
  });

  it("reports no match when no triplet connects the pair", () => {
    expect(
      findRelationForPair({
        relations: [evidenceSupportsClaim],
        sourceNodeType: "question",
        targetNodeType: "claim",
      }),
    ).toEqual({ isDirect: false, isReverse: false, matchingRelation: null });
  });
});
