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
  nodeSchemaToCrossApp,
  nodeUidsWithTypeToCrossApp,
} from "~/utils/roamToCrossAppConverters";
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

const nodeSchema = (): DiscourseNode => ({
  text: "Evidence",
  type: "_EVD-node",
  shortcut: "e",
  format: "[[EVD]] - {content}",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
});

// For the timestamp tests: what Roam holds about one node type page.
const convertSchemaPull = (pullResult: Record<string, unknown> | null) => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      pull: () => pullResult,
    },
  };
  return nodeSchemaToCrossApp(nodeSchema());
};

const schemaPull = {
  ":create/time": 1000,
  ":create/user": { ":user/uid": "user-1" },
};

describe("nodeSchemaToCrossApp timestamps", () => {
  it("takes the page edit time, as written when a block below it changes", () => {
    const schema = convertSchemaPull({
      ...schemaPull,
      ":edit/time": 2000,
      ":page/edit-time": 4000,
    });
    expect(schema?.modifiedAt).toEqual(new Date(4000));
  });

  it("falls back to the create time when neither exists", () => {
    const schema = convertSchemaPull(schemaPull);
    expect(schema?.modifiedAt).toEqual(new Date(1000));
  });

  it("is null without an author, rather than a concept that cannot be inserted", () => {
    expect(convertSchemaPull({ ":create/time": 1000 })).toBeNull();
  });
});
