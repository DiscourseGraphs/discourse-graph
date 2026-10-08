import { describe, expect, it } from "vitest";
import {
  matchNodeTypes,
  parseTripleEndNames,
  pickTripleCandidate,
} from "../tripleMatching";

describe("matchNodeTypes", () => {
  it("matches strongly on the same RID, local id or origin", () => {
    expect(matchNodeTypes({ rid: "a" }, { rid: "a" })).toBe("strong");
    expect(matchNodeTypes({ localId: "evd" }, { localId: "evd" })).toBe(
      "strong",
    );
    expect(matchNodeTypes({ rid: "b" }, { importedFromRid: "b" })).toBe(
      "strong",
    );
    expect(matchNodeTypes({ importedFromRid: "c" }, { rid: "c" })).toBe(
      "strong",
    );
    expect(
      matchNodeTypes({ importedFromRid: "c" }, { importedFromRid: "c" }),
    ).toBe("strong");
  });

  it("matches on the normalized name only when nothing stronger matches", () => {
    expect(matchNodeTypes({ name: " Evidence" }, { name: "evidence" })).toBe(
      "name",
    );
    expect(matchNodeTypes({ name: "Evidence" }, { name: "Claim" })).toBe(
      undefined,
    );
  });

  it("matches a shared default id only by name", () => {
    expect(
      matchNodeTypes(
        { localId: "_CLM-node", name: "Claim" },
        { localId: "_CLM-node", name: "Claim" },
      ),
    ).toBe("name");
    expect(
      matchNodeTypes(
        { localId: "_CLM-node", name: "Claim" },
        { localId: "_CLM-node", name: "Assertion" },
      ),
    ).toBe(undefined);
  });

  it("matches a user-created id strongly even when it starts with an underscore", () => {
    expect(
      matchNodeTypes({ localId: "_x1Yz2Ab3" }, { localId: "_x1Yz2Ab3" }),
    ).toBe("strong");
  });

  it("does not match on fields both sides lack", () => {
    expect(matchNodeTypes({}, {})).toBe(undefined);
  });
});

describe("pickTripleCandidate", () => {
  const x = { rid: "orn:a/claim", name: "Claim" };
  const yInB = { rid: "orn:b/evidence", localId: "evidence", name: "Evidence" };

  it("prefers the candidate whose ends match strongly over one matching by name", () => {
    expect(
      pickTripleCandidate(
        [
          {
            candidate: "renamed",
            source: x,
            destination: { localId: "evidence", name: "Data" },
          },
          {
            candidate: "same-name",
            source: x,
            destination: { localId: "other", name: "Evidence" },
          },
        ],
        { source: x, destination: yInB },
      ),
    ).toBe("renamed");
  });

  it("matches a hidden end by the name parsed from the triple", () => {
    expect(
      pickTripleCandidate(
        [{ candidate: "t", source: x, destination: { name: "evidence" } }],
        { source: x, destination: yInB },
      ),
    ).toBe("t");
  });

  it("prefers one strong end over none", () => {
    expect(
      pickTripleCandidate(
        [
          {
            candidate: "one-strong",
            source: x,
            destination: { name: "Evidence" },
          },
          {
            candidate: "names-only",
            source: { name: "Claim" },
            destination: { name: "Evidence" },
          },
        ],
        { source: x, destination: yInB },
      ),
    ).toBe("one-strong");
  });

  it("picks nothing when two candidates match at the same level", () => {
    expect(
      pickTripleCandidate(
        [
          { candidate: "one", source: x, destination: { name: "Evidence" } },
          { candidate: "two", source: x, destination: { name: "evidence" } },
        ],
        { source: x, destination: yInB },
      ),
    ).toBe(undefined);
  });

  it("picks nothing when one end matches no candidate", () => {
    expect(
      pickTripleCandidate(
        [{ candidate: "t", source: x, destination: { name: "Question" } }],
        { source: x, destination: yInB },
      ),
    ).toBe(undefined);
  });
});

describe("parseTripleEndNames", () => {
  it("splits an Obsidian triple name around its label", () => {
    expect(
      parseTripleEndNames("Claim -Supports-> Evidence", "Supports"),
    ).toEqual({ source: "Claim", destination: "Evidence" });
  });

  it("gives up when the label marker is missing or repeated", () => {
    expect(parseTripleEndNames("Claim supports Evidence", "Supports")).toBe(
      undefined,
    );
    expect(
      parseTripleEndNames("A -Supports-> B -Supports-> C", "Supports"),
    ).toBe(undefined);
  });
});
