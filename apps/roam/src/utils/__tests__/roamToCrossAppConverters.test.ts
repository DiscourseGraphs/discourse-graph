import { describe, expect, it, vi } from "vitest";
import type { Json } from "@repo/database/dbTypes";

vi.mock("roamjs-components/queries/getFullTreeByParentUid", () => ({
  default: () => ({ children: [] }),
}));
vi.mock("roamjs-components/queries/getPageViewType", () => ({
  default: () => "bullet",
}));
vi.mock("~/utils/pageToMarkdown", () => ({ toMarkdown: () => "" }));

import {
  contentNodeToCrossApp,
  nodeSchemaToCrossApp,
  nodeUidsWithTypeToCrossApp,
} from "~/utils/roamToCrossAppConverters";
import {
  crossAppNodeSchemaToDbConcept,
  crossAppNodeToDbConcept,
  crossAppNodeToDbContent,
} from "@repo/database/lib/crossAppConverters";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

const USER_ROW = { ":db/id": 5, ":user/uid": "user-1" };

const convertRow = async (row: Record<string, Json>) => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      data: {
        async: {
          pull_many: vi
            .fn()
            .mockResolvedValueOnce([row])
            .mockResolvedValueOnce([USER_ROW]),
        },
      },
    },
  };
  const [node] = await nodeUidsWithTypeToCrossApp([
    { uid: "node-1", type: "schema-1" },
  ]);
  return node;
};

const baseRow = {
  ":block/uid": "node-1",
  ":node/title": "CLM - claim",
  ":create/user": { ":db/id": 5 },
  ":create/time": 1000,
};

describe("nodeUidsWithTypeToCrossApp timestamps", () => {
  it("uses the page edit time when present", async () => {
    const node = await convertRow({
      ...baseRow,
      ":edit/time": 2000,
      ":page/edit-time": 3000,
    });
    expect(node.createdAt).toEqual(new Date(1000));
    expect(node.modifiedAt).toEqual(new Date(3000));
  });

  it("falls back to the node edit time when page edit time is absent", async () => {
    const node = await convertRow({ ...baseRow, ":edit/time": 2000 });
    expect(node.modifiedAt).toEqual(new Date(2000));
  });

  it("falls back to the create time when no edit time exists", async () => {
    const node = await convertRow(baseRow);
    expect(node.modifiedAt).toEqual(new Date(1000));
  });
});

const NODE_ROW = {
  author_local_id: "user-1",
  source_local_id: "node-1",
  created: 1000,
  last_modified: 2000,
  text: "EVD - some evidence",
  type: "schema-1",
};

describe("contentNodeToCrossApp", () => {
  it("names a page-backed node by its title, as a plain direct", () => {
    const node = contentNodeToCrossApp(NODE_ROW);
    expect(node.content.direct.value).toEqual("EVD - some evidence");
    expect(node.content.direct.variant).toEqual("direct");
    expect(node.content.full).toBeUndefined();
    expect(node.nodeType).toEqual("schema-1");
    expect(node.createdAt).toEqual(new Date(1000));
    expect(node.modifiedAt).toEqual(new Date(2000));
  });

  it("names a block-backed node by its page title and its text", () => {
    const node = contentNodeToCrossApp({
      ...NODE_ROW,
      node_title: "EVD - some evidence",
      text: "the block text",
    });
    expect(node.content.direct.value).toEqual(
      "EVD - some evidence the block text",
    );
    expect(node.content.direct.variant).toEqual("direct_and_description");
  });

  it("falls back to a plain direct when the first child block is missing", () => {
    const node = contentNodeToCrossApp({
      ...NODE_ROW,
      node_title: "EVD - some evidence",
      text: "",
    });
    expect(node.content.direct.value).toEqual("EVD - some evidence");
    expect(node.content.direct.variant).toEqual("direct");
  });

  it("carries the variant of the direct slot into the db content", () => {
    const node = contentNodeToCrossApp({
      ...NODE_ROW,
      node_title: "EVD - some evidence",
      text: "the block text",
    });
    expect(crossAppNodeToDbContent(node, "direct")).toMatchObject({
      source_local_id: "node-1",
      text: "EVD - some evidence the block text",
      variant: "direct_and_description",
      scale: "document",
      author_local_id: "user-1",
    });
  });

  it("carries the node's direct content into the db concept", () => {
    const concept = crossAppNodeToDbConcept(contentNodeToCrossApp(NODE_ROW));
    expect(concept.contents_inline).toEqual([
      expect.objectContaining({
        source_local_id: "node-1",
        text: "EVD - some evidence",
        variant: "direct",
      }),
    ]);
    expect(concept).toMatchObject({
      source_local_id: "node-1",
      name: "EVD - some evidence",
      author_local_id: "user-1",
      schema_represented_by_local_id: "schema-1",
    });
  });
});

const schemaPull = () => ({
  ":create/time": 1000,
  ":edit/time": 2000,
  ":create/user": { ":user/uid": "user-1" },
});

const convertSchema = (node: DiscourseNode) => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: { pull: schemaPull },
  };
  return nodeSchemaToCrossApp(node);
};

const schemaNode = (overrides: Partial<DiscourseNode>): DiscourseNode => ({
  text: "Evidence",
  type: "_EVD-node",
  shortcut: "e",
  format: "[[EVD]] - {content}",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  ...overrides,
});

describe("nodeSchemaToCrossApp", () => {
  it("carries the modification time, so that the concept can be inserted", () => {
    const schema = convertSchema(schemaNode({}));
    expect(schema?.createdAt).toEqual(new Date(1000));
    expect(schema?.modifiedAt).toEqual(new Date(2000));
  });

  it("renders the template as text, under template_content in the db concept", () => {
    const schema = convertSchema(
      schemaNode({
        template: [
          { text: "Question:", children: [{ text: "why?" }] },
          { text: "{{roam/render}}" },
        ],
      }),
    );
    expect(schema?.template).toEqual("* Question:\n   * why?\n   \n");
    const concept = crossAppNodeSchemaToDbConcept(schema!);
    expect(concept.literal_content).toEqual({
      template_content: "* Question:\n   * why?\n   \n",
    });
  });

  it("omits the template when the node type has none", () => {
    const schema = convertSchema(schemaNode({ template: [] }));
    expect(schema?.template).toBeUndefined();
    expect(
      crossAppNodeSchemaToDbConcept(schema!).literal_content,
    ).toBeUndefined();
  });
});
