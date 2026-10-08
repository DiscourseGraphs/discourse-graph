import { describe, expect, it } from "vitest";
import type { DiscourseRelationType } from "~/types";
import { getRelationTypeErrors } from "~/utils/typeUtils";

const relationType = (
  label: string,
  complement: string,
): DiscourseRelationType => ({
  id: `${label}-${complement}`,
  label,
  complement,
  color: "black",
  created: 0,
  modified: 0,
});

describe("getRelationTypeErrors", () => {
  it("returns no errors for distinct types", () => {
    expect(
      getRelationTypeErrors([
        relationType("supports", "is supported by"),
        relationType("opposes", "is opposed by"),
      ]),
    ).toEqual({});
  });

  it("flags both types sharing a label", () => {
    expect(
      getRelationTypeErrors([
        relationType("supports", "is supported by"),
        relationType("opposes", "is opposed by"),
        relationType("supports", "backs"),
      ]),
    ).toEqual({
      0: 'Duplicate label "supports"',
      2: 'Duplicate label "supports"',
    });
  });

  it("flags both types sharing a complement", () => {
    expect(
      getRelationTypeErrors([
        relationType("supports", "is supported by"),
        relationType("backs", "is supported by"),
      ]),
    ).toEqual({
      0: 'Duplicate complement "is supported by"',
      1: 'Duplicate complement "is supported by"',
    });
  });

  it("skips types missing a label or complement", () => {
    expect(
      getRelationTypeErrors([
        relationType("supports", "is supported by"),
        relationType("supports", ""),
        relationType("", "is supported by"),
      ]),
    ).toEqual({});
  });

  it("matches labels exactly, without trimming or case folding", () => {
    expect(
      getRelationTypeErrors([
        relationType("supports", "is supported by"),
        relationType("Supports ", "Is supported by"),
      ]),
    ).toEqual({});
  });
});
