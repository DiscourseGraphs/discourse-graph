import { beforeEach, describe, expect, it, vi } from "vitest";

type SettingsTreeNode = {
  text: string;
  children?: SettingsTreeNode[];
};

type GetSettingValueArgs = {
  tree?: SettingsTreeNode[];
  key: string;
};

vi.mock("roamjs-components/util/getSubTree", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/util/getSettingValueFromTree", () => ({
  default: vi.fn(
    ({ tree = [], key }: GetSettingValueArgs): string =>
      tree.find((t: { text: string }) => t.text === key)?.children?.[0]?.text ||
      "",
  ),
}));
vi.mock("roamjs-components/writes/createBlock", () => ({
  default: vi.fn(),
}));

import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import parseQuery from "~/utils/parseQuery";
import { getTitleDatalog } from "~/utils/conditionToDatalog";

const mockedGetSubTree = vi.mocked(getSubTree);
const mockedCreateBlock = vi.mocked(createBlock);

describe("parseQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        util: { generateUID: () => "new-uid" },
      },
    };
  });

  it("parses query nodes and builds default return column", () => {
    const queryTree = {
      uid: "parent",
      children: [
        { text: "conditions" },
        { text: "selections" },
        { text: "custom" },
      ],
    };
    mockedGetSubTree.mockImplementation(({ key }) => {
      if (key === "conditions") {
        return { uid: "conditions-uid", text: "conditions", children: [] };
      }
      if (key === "selections") {
        return {
          uid: "selections-uid",
          text: "selections",
          children: [
            {
              uid: "sel-node",
              text: "node",
              children: [{ uid: "title-label", text: "Title", children: [] }],
            },
            {
              uid: "sel-created",
              text: "created",
              children: [
                { uid: "created-label", text: "Created", children: [] },
              ],
            },
          ],
        };
      }
      return {
        uid: "custom-uid",
        text: "custom",
        children: [
          { uid: "custom-query", text: "[:find ?x]", children: [] },
          { uid: "custom-enabled", text: "enabled", children: [] },
        ],
      };
    });

    const parsed = parseQuery(queryTree as never);

    expect(parsed.columns).toEqual([
      { key: "Title", uid: "returnuid", selection: "node" },
      { key: "Created", uid: "sel-created", selection: "created" },
    ]);
    expect(parsed.isCustomEnabled).toBe(true);
    expect(parsed.customNode).toBe("[:find ?x]");
  });

  it("creates missing subtree blocks", () => {
    const queryTree = { uid: "parent", children: [] };
    mockedGetSubTree.mockReturnValue({ uid: "", children: [] } as never);

    parseQuery(queryTree as never);

    expect(mockedCreateBlock).toHaveBeenCalledTimes(3);
  });
});

describe("getTitleDatalog", () => {
  it("maps :in input target to variable binding", () => {
    const clauses = getTitleDatalog({ source: "node", target: ":in title" });
    expect(clauses[0]).toMatchObject({
      type: "data-pattern",
      arguments: [
        { type: "variable", value: "node" },
        { type: "constant", value: ":node/title" },
        { type: "variable", value: "title" },
      ],
    });
  });

  it("maps regex target to re-find expression", () => {
    const clauses = getTitleDatalog({ source: "node", target: "/hello/i" });
    expect(clauses).toHaveLength(3);
    expect(clauses[1]).toMatchObject({ type: "fn-expr", fn: "re-pattern" });
    expect(clauses[2]).toMatchObject({ type: "pred-expr", pred: "re-find" });
  });
});
