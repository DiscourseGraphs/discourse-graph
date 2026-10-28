import { describe, expect, it } from "vitest";
import INITIAL_NODE_VALUES from "~/data/defaultDiscourseNodes";
import DEFAULT_RELATIONS_BLOCK_PROPS from "~/components/settings/data/defaultRelationsBlockProps";
import {
  DISCOURSE_CONTEXT_PREVIEW_NODES,
  getDiscourseContextPreview,
  type DiscourseContextPreviewNode,
} from "~/data/discourseContextPreview";

const previewNodes = Object.keys(
  DISCOURSE_CONTEXT_PREVIEW_NODES,
) as DiscourseContextPreviewNode[];

describe("discourse context preview", () => {
  it("covers every default node type, relation, and complement", () => {
    expect(
      new Set(
        Object.values(DISCOURSE_CONTEXT_PREVIEW_NODES).map((node) => node.type),
      ),
    ).toEqual(new Set(INITIAL_NODE_VALUES.map((node) => node.type)));
    const labels = new Set(
      previewNodes.flatMap((node) =>
        getDiscourseContextPreview(node).results.map((group) => group.label),
      ),
    );
    expect(labels).toEqual(
      new Set(
        Object.values(DEFAULT_RELATIONS_BLOCK_PROPS).flatMap(
          ({ label, complement }) => [label, complement],
        ),
      ),
    );
  });

  it("makes grouping meaningful with both claim and evidence supporting a claim", () => {
    const supportedBy = getDiscourseContextPreview("claim").results.find(
      ({ label }) => label === "Supported By",
    );
    expect(
      Object.values(supportedBy?.results ?? {}).map((row) => row.target),
    ).toEqual(["Evidence", "Claim"]);
  });

  it("demonstrates each default source and destination pairing", () => {
    Object.values(DEFAULT_RELATIONS_BLOCK_PROPS).forEach((relation) => {
      const destinationLabel = INITIAL_NODE_VALUES.find(
        (node) => node.type === relation.destination,
      )?.text;
      const hasDefaultPairing = previewNodes.some(
        (node) =>
          DISCOURSE_CONTEXT_PREVIEW_NODES[node].type === relation.source &&
          getDiscourseContextPreview(node).results.some(
            (group) =>
              group.label === relation.label &&
              Object.values(group.results).some(
                (row) => row.target === destinationLabel,
              ),
          ),
      );
      expect(hasDefaultPairing).toBe(true);
    });
  });

  it.each(previewNodes)(
    "keeps %s connected and safe to render without graph entities",
    (node) => {
      const preview = getDiscourseContextPreview(node);
      const rows = preview.results.flatMap((group) =>
        Object.values(group.results),
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(preview.score).toBe(rows.length);
      expect(preview.refs).toBe(DISCOURSE_CONTEXT_PREVIEW_NODES[node].refs);
      rows.forEach((row) => {
        expect(row).not.toHaveProperty("ctxTargetUid");
        expect(row).not.toHaveProperty("id");
        expect(row).not.toHaveProperty("text-uid");
        expect(row.uid).toMatch(/^dg-preview-/);
      });
    },
  );

  it("keeps reference counts separate from the relation score", () => {
    const { refs, score } = getDiscourseContextPreview("claim");
    expect(score).not.toBe(refs);
  });
});
