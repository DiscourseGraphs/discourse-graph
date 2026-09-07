import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractListPrefix,
  mergeAdjacentRanges,
  tagNameFromSyntaxNode,
  titleFromTaggedLine,
} from "./discourseTagText";

void describe("tagNameFromSyntaxNode", () => {
  void it("reads the tag from an Obsidian hashtag node name", () => {
    assert.equal(
      tagNameFromSyntaxNode("hashtag_hashtag-end_meta_tag-clm-candidate"),
      "clm-candidate",
    );
  });

  void it("reads the tag from the opening delimiter node", () => {
    assert.equal(
      tagNameFromSyntaxNode(
        "formatting_formatting-hashtag_hashtag_hashtag-begin_meta_tag-src-candidate",
      ),
      "src-candidate",
    );
  });

  void it("keeps hyphens inside the tag name", () => {
    assert.equal(
      tagNameFromSyntaxNode("hashtag_hashtag-end_tag-a-b-c"),
      "a-b-c",
    );
  });

  void it("ignores nodes that are not hashtags", () => {
    assert.equal(tagNameFromSyntaxNode("header_header-1"), null);
    assert.equal(tagNameFromSyntaxNode("inline-code"), null);
  });

  void it("ignores a hashtag node carrying no tag segment", () => {
    assert.equal(tagNameFromSyntaxNode("hashtag_hashtag-begin"), null);
    assert.equal(tagNameFromSyntaxNode("hashtag_tag-"), null);
  });
});

void describe("mergeAdjacentRanges", () => {
  const style = (nodeTypeId: string) => ({ nodeTypeId });

  void it("joins the # delimiter to the tag name", () => {
    assert.deepEqual(
      mergeAdjacentRanges([
        { from: 0, to: 1, style: style("clm") },
        { from: 1, to: 14, style: style("clm") },
      ]),
      [{ from: 0, to: 14, style: style("clm") }],
    );
  });

  void it("keeps separate tags of the same type apart when not touching", () => {
    const merged = mergeAdjacentRanges([
      { from: 0, to: 4, style: style("clm") },
      { from: 9, to: 13, style: style("clm") },
    ]);
    assert.equal(merged.length, 2);
  });

  void it("does not merge touching ranges of different node types", () => {
    const merged = mergeAdjacentRanges([
      { from: 0, to: 4, style: style("clm") },
      { from: 4, to: 8, style: style("evd") },
    ]);
    assert.equal(merged.length, 2);
  });

  void it("sorts unordered input, as CodeMirror requires", () => {
    const merged = mergeAdjacentRanges([
      { from: 20, to: 24, style: style("evd") },
      { from: 0, to: 4, style: style("clm") },
    ]);
    assert.deepEqual(
      merged.map((r) => r.from),
      [0, 20],
    );
  });

  void it("leaves the input array untouched", () => {
    const input = [
      { from: 0, to: 1, style: style("clm") },
      { from: 1, to: 5, style: style("clm") },
    ];
    mergeAdjacentRanges(input);
    assert.deepEqual(
      input.map((r) => r.to),
      [1, 5],
    );
  });
});

void describe("titleFromTaggedLine", () => {
  void it("drops the trailing tag and surrounding whitespace", () => {
    assert.equal(
      titleFromTaggedLine("This is a claim about things #clm-candidate"),
      "This is a claim about things",
    );
  });

  void it("drops a list marker along with the tag", () => {
    assert.equal(
      titleFromTaggedLine("- [ ] a task worth tracking #evd-candidate"),
      "a task worth tracking",
    );
  });

  void it("drops every tag on the line", () => {
    assert.equal(
      titleFromTaggedLine("#clm-candidate middle #evd-candidate"),
      "middle",
    );
  });

  void it("removes characters Obsidian rejects in file names", () => {
    assert.equal(titleFromTaggedLine("a/b\\c:d #clm-candidate"), "abcd");
  });

  void it("collapses runs of whitespace", () => {
    assert.equal(
      titleFromTaggedLine("too    many   spaces #clm-candidate"),
      "too many spaces",
    );
  });
});

void describe("extractListPrefix", () => {
  void it("keeps a bullet prefix", () => {
    assert.equal(extractListPrefix("- item"), "- ");
  });

  void it("keeps a checkbox prefix", () => {
    assert.equal(extractListPrefix("- [x] done"), "- [x] ");
  });

  void it("keeps a numbered prefix and its indentation", () => {
    assert.equal(extractListPrefix("  1. item"), "  1. ");
  });

  void it("returns nothing for a plain line", () => {
    assert.equal(extractListPrefix("plain line"), "");
  });
});
