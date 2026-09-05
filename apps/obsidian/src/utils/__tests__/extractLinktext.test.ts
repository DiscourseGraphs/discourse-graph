import { describe, expect, it } from "vitest";

import { extractLinktext } from "~/utils/internalLinkParsing";

describe("extractLinktext", () => {
  it("reads a plain wikilink", () => {
    expect(extractLinktext("[[Claim]]")).toBe("Claim");
  });

  it("drops a wikilink alias", () => {
    expect(extractLinktext("[[Claim|the claim]]")).toBe("Claim");
  });

  it("keeps a wikilink subpath for the caller to strip", () => {
    expect(extractLinktext("[[Claim#Evidence]]")).toBe("Claim#Evidence");
  });

  it("reads a markdown link target", () => {
    expect(extractLinktext("[the claim](Claim.md)")).toBe("Claim.md");
  });

  it("decodes a percent-encoded markdown link", () => {
    expect(extractLinktext("[a claim](My%20Claim.md)")).toBe("My Claim.md");
  });

  it("falls back to the raw path when decoding fails", () => {
    // A lone % is not valid percent-encoding; decodeURIComponent throws.
    expect(extractLinktext("[bad](100%.md)")).toBe("100%.md");
  });

  it("reads a markdown link inside a folder", () => {
    expect(extractLinktext("[c](Discourse Nodes/Claim.md)")).toBe(
      "Discourse Nodes/Claim.md",
    );
  });
});
