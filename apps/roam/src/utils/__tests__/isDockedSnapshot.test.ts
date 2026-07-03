import { describe, expect, it } from "vitest";
import { isDockedSnapshot } from "~/components/AdvancedNodeSearchDialog/dockedSearchSnapshot";
import type { SearchResult } from "~/components/AdvancedNodeSearchDialog/utils";

const sampleResult = (uid: string): SearchResult => ({
  uid,
  title: `[[C]] - ${uid}`,
  type: "claim",
  nodeTypeLabel: "Claim",
  excerpt: "",
  createdAt: "",
  lastModified: "",
  authorName: "Unknown",
});

describe("isDockedSnapshot", () => {
  it("returns true when the query matches and docked results exist", () => {
    expect(
      isDockedSnapshot({
        debouncedSearchTerm: "meaning",
        dockedQuery: "meaning",
        dockedResults: [sampleResult("a")],
      }),
    ).toBe(true);
  });

  it("returns false when the query differs", () => {
    expect(
      isDockedSnapshot({
        debouncedSearchTerm: "edited query",
        dockedQuery: "meaning",
        dockedResults: [sampleResult("a")],
      }),
    ).toBe(false);
  });

  it("returns false when docked results are empty", () => {
    expect(
      isDockedSnapshot({
        debouncedSearchTerm: "meaning",
        dockedQuery: "meaning",
        dockedResults: [],
      }),
    ).toBe(false);
  });
});
