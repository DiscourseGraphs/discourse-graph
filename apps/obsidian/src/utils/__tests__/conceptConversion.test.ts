import { TFile } from "obsidian";
import { describe, expect, it } from "vitest";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type { DiscourseNode, RelationInstance } from "~/types";
import {
  discourseNodeInstanceToLocalConcept,
  discourseNodeSchemaToLocalConcept,
  relationInstanceToLocalConcept,
} from "~/utils/conceptConversion";
import type { DiscourseNodeInVault } from "~/utils/getDiscourseNodes";

const conceptFor = ({
  format,
  basename,
  sourceDocument,
}: {
  format: string;
  basename: string;
  sourceDocument?: string;
}): LocalConceptDataInput => {
  const file = new TFile();
  file.basename = basename;
  file.path = `${basename}.md`;
  return discourseNodeInstanceToLocalConcept({
    accountLocalId: "account-1",
    nodeData: {
      file,
      frontmatter: { nodeInstanceId: "node-1", nodeTypeId: "type-1" },
      nodeTypeId: "type-1",
      nodeInstanceId: "node-1",
      created: "2026-10-01T00:00:00.000Z",
      last_modified: "2026-10-02T00:00:00.000Z",
      changeTypes: [],
      sourceDocument,
    },
    nodeTypesById: {
      "type-1": {
        id: "type-1",
        name: "Claim",
        format,
        created: 0,
        modified: 0,
      },
    },
  });
};

describe("discourseNodeInstanceToLocalConcept core_title", () => {
  it("extracts the content from a title matching the node type's format", () => {
    expect(
      conceptFor({ format: "CLM - {content}", basename: "CLM - sleep" }),
    ).toMatchObject({ literal_content: { core_title: "sleep" } });
  });

  it("extracts the content from a format with regex metacharacters", () => {
    expect(
      conceptFor({
        format: "Claim (draft) - {content}",
        basename: "Claim (draft) - sleep improves memory",
      }),
    ).toMatchObject({
      literal_content: { core_title: "sleep improves memory" },
    });
  });
});

describe("discourseNodeInstanceToLocalConcept source", () => {
  it("publishes the Source as local reference content", () => {
    expect(
      conceptFor({
        format: "EVD - {content}",
        basename: "EVD - Evidence title",
        sourceDocument: "source",
      }),
    ).toMatchObject({ local_reference_content: { sourceDocument: "source" } });
  });

  it("omits reference content when the node has no Source", () => {
    expect(
      conceptFor({
        format: "EVD - {content}",
        basename: "EVD - Evidence title",
      }),
    ).not.toHaveProperty("local_reference_content");
  });
});

describe("discourseNodeInstanceToLocalConcept Content", () => {
  it("sends no Content for a node whose title and text are unchanged", () => {
    expect(
      conceptFor({ format: "CLM - {content}", basename: "CLM - sleep" }),
    ).not.toHaveProperty("contents_inline");
  });
});

const NODE_TYPE: DiscourseNode = {
  id: "type-1",
  name: "Claim",
  format: "CLM - {content}",
  shortcut: "C",
  color: "#7DA13E",
  tag: "clm-candidate",
  keyImage: true,
  folderPath: "Claims",
  authorId: 3,
  created: 0,
  modified: 0,
};

describe("discourseNodeSchemaToLocalConcept format", () => {
  it("publishes the format at the top level of literal content", () => {
    expect(
      discourseNodeSchemaToLocalConcept({
        accountLocalId: "account-1",
        node: NODE_TYPE,
      }),
    ).toMatchObject({ literal_content: { format: "CLM - {content}" } });
  });

  it("publishes the color at the top level of literal content", () => {
    expect(
      discourseNodeSchemaToLocalConcept({
        accountLocalId: "account-1",
        node: NODE_TYPE,
      }),
    ).toMatchObject({ literal_content: { color: "#7DA13E" } });
  });

  it("keeps the other metadata in source data without the format or the color", () => {
    expect(
      discourseNodeSchemaToLocalConcept({
        accountLocalId: "account-1",
        node: NODE_TYPE,
      }),
    ).toHaveProperty("literal_content.source_data", {
      shortcut: "C",
      tag: "clm-candidate",
      keyImage: true,
      folderPath: "Claims",
      authorId: 3,
    });
  });
});

describe("relationInstanceToLocalConcept author", () => {
  const noteInVault = (nodeInstanceId: string): DiscourseNodeInVault => ({
    file: Object.assign(new TFile(), { basename: nodeInstanceId }),
    frontmatter: { nodeInstanceId, nodeTypeId: "type-1" },
    nodeTypeId: "type-1",
    nodeInstanceId,
  });
  const relationConceptFor = (
    relation: Partial<RelationInstance>,
  ): LocalConceptDataInput | null =>
    relationInstanceToLocalConcept({
      accountLocalId: "account-1",
      relationTypesById: {
        "supports-type": {
          id: "supports-type",
          label: "supports",
          complement: "is supported by",
          color: "green",
          created: 0,
          modified: 0,
        },
      },
      allNodesById: {
        "node-1": noteInVault("node-1"),
        "node-2": noteInVault("node-2"),
      },
      relationInstanceData: {
        id: "relation-1",
        type: "supports-type",
        source: "node-1",
        destination: "node-2",
        created: 0,
        ...relation,
      },
    });

  it("keeps a relation's numeric authorId as author_id, without an author_local_id", () => {
    const concept = relationConceptFor({ authorId: 9 });
    expect(concept).toHaveProperty("author_id", 9);
    expect(concept).not.toHaveProperty("author_local_id");
  });
});
