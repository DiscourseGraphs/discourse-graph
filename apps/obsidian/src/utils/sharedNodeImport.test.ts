import { describe, expect, it } from "vitest";
import {
  buildImportedNodeFrontmatter,
  buildSourceNodeTypeIdMap,
  getAvailableImportPath,
  getImportedNodeKey,
} from "./sharedNodeImport";

const ROAM_SOURCE_NODE_ID = "tgWb6JozF";
const ROAM_SOURCE_NODE_TYPE_ID = "rCLM0schema";
const ROAM_SOURCE_SPACE_ID = 42;

const roamFullMarkdown = `# Sleep improves memory consolidation

Multiple studies show that sleep after learning strengthens memory traces.

- Supported by [[EVD]] - Rasch & Born 2013
`;

describe("Roam-origin shared node import", () => {
  it("derives node type identity without relying on markdown frontmatter", () => {
    const sourceNodeTypeIds = buildSourceNodeTypeIdMap({
      concepts: [
        {
          source_local_id: ROAM_SOURCE_NODE_ID,
          schema_id: 200,
        },
      ],
      schemas: [
        {
          id: 200,
          source_local_id: ROAM_SOURCE_NODE_TYPE_ID,
        },
      ],
    });

    expect(roamFullMarkdown).not.toContain("nodeTypeId:");
    expect(sourceNodeTypeIds.get(ROAM_SOURCE_NODE_ID)).toBe(
      ROAM_SOURCE_NODE_TYPE_ID,
    );
  });

  it("adds stable source identity while preserving existing metadata", () => {
    expect(
      buildImportedNodeFrontmatter({
        existingFrontmatter: { aliases: ["Sleep and memory"] },
        sourceNodeId: ROAM_SOURCE_NODE_ID,
        mappedNodeTypeId: "local-claim-type",
        importedFromRid: "https://roamresearch.com/#/app/MAPLab/tgWb6JozF",
        importedModifiedAt: 1_781_275_600_000,
        authorId: 17,
      }),
    ).toEqual({
      aliases: ["Sleep and memory"],
      nodeInstanceId: ROAM_SOURCE_NODE_ID,
      nodeTypeId: "local-claim-type",
      importedFromRid: "https://roamresearch.com/#/app/MAPLab/tgWb6JozF",
      lastModified: 1_781_275_600_000,
      authorId: 17,
    });
  });

  it("scopes duplicate prevention to the source space and node identity", () => {
    expect(
      getImportedNodeKey({
        spaceId: ROAM_SOURCE_SPACE_ID,
        sourceLocalId: ROAM_SOURCE_NODE_ID,
      }),
    ).toBe(`${ROAM_SOURCE_SPACE_ID}:${ROAM_SOURCE_NODE_ID}`);
    expect(
      getImportedNodeKey({
        spaceId: ROAM_SOURCE_SPACE_ID + 1,
        sourceLocalId: ROAM_SOURCE_NODE_ID,
      }),
    ).not.toBe(`${ROAM_SOURCE_SPACE_ID}:${ROAM_SOURCE_NODE_ID}`);
  });

  it("keeps distinct same-title nodes in separate files", async () => {
    const existingPaths = new Set([
      "import/Roam/Sleep improves memory consolidation.md",
    ]);

    await expect(
      getAvailableImportPath({
        desiredPath: "import/Roam/Sleep improves memory consolidation.md",
        pathExists: (path) => Promise.resolve(existingPaths.has(path)),
      }),
    ).resolves.toBe("import/Roam/Sleep improves memory consolidation (1).md");
  });
});
