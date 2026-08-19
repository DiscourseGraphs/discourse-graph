import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Json } from "@repo/database/dbTypes";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

const mocks = vi.hoisted(() => ({
  getDiscourseNodes: vi.fn(),
}));

vi.mock("roamjs-components/queries/getFullTreeByParentUid", () => ({
  default: () => ({ children: [] }),
}));
vi.mock("roamjs-components/queries/getPageViewType", () => ({
  default: () => "bullet",
}));
vi.mock("~/utils/pageToMarkdown", () => ({ toMarkdown: () => "" }));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: mocks.getDiscourseNodes,
}));

import {
  fullContentNodeToCrossApp,
  nodeUidsWithTypeToCrossApp,
} from "~/utils/roamToCrossAppConverters";

const claimSchema: DiscourseNode = {
  type: "schema-1",
  text: "Claim",
  shortcut: "C",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "CLM - {content}",
};

beforeEach(() => {
  mocks.getDiscourseNodes.mockReturnValue([claimSchema]);
});

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

describe("nodeUidsWithTypeToCrossApp coreTitle", () => {
  it("extracts the content from a title matching the node type's format", async () => {
    const node = await convertRow(baseRow);
    expect(node.coreTitle).toBe("claim");
  });

  it("keeps the whole title when the node type is unknown", async () => {
    mocks.getDiscourseNodes.mockReturnValue([]);
    const node = await convertRow(baseRow);
    expect(node.coreTitle).toBe("CLM - claim");
  });
});

describe("fullContentNodeToCrossApp coreTitle", () => {
  const baseNode = {
    author_local_id: "user-1",
    source_local_id: "node-1",
    created: 1000,
    last_modified: 2000,
    node_type_id: "schema-1",
    text: "CLM - claim",
  };

  it("extracts the content from the title", () => {
    const node = fullContentNodeToCrossApp(baseNode);
    expect(node.coreTitle).toBe("claim");
  });

  it("extracts from the page title when node_title is present", () => {
    const node = fullContentNodeToCrossApp({
      ...baseNode,
      text: "some block text",
      node_title: "CLM - claim",
    });
    expect(node.coreTitle).toBe("claim");
  });

  it("keeps the whole title when it does not match the format", () => {
    const node = fullContentNodeToCrossApp({
      ...baseNode,
      text: "unrelated title",
    });
    expect(node.coreTitle).toBe("unrelated title");
  });
});
