import { beforeEach, describe, expect, it, vi } from "vitest";

type ConditionToDatalogArgs = {
  source: string;
  target: string;
};

vi.mock("~/utils/conditionToDatalog", () => ({
  default: vi.fn(({ source, target }: ConditionToDatalogArgs) => [
    {
      type: "data-pattern",
      arguments: [
        { type: "variable", value: source },
        { type: "constant", value: ":rel" },
        /^:in /.test(target)
          ? { type: "variable", value: target.substring(4) }
          : { type: "constant", value: '"value"' },
      ],
    },
  ]),
}));
vi.mock("~/utils/predefinedSelections", () => ({
  default: [
    {
      test: /^created$/,
      pull: () => "(pull ?node [:create/time])",
      mapper: (r: Record<string, string>) => r[":create/time"] || "",
    },
  ],
}));
vi.mock("roamjs-components/util/env", () => ({ getNodeEnv: () => "test" }));

import fireQuery, { fireQuerySync, getDatalogQuery } from "~/utils/fireQuery";

describe("getDatalogQuery", () => {
  it("includes :in variables and de-duplicates expected inputs", async () => {
    const built = getDatalogQuery({
      conditions: [
        {
          type: "clause",
          relation: "r",
          source: "node",
          target: ":in title",
          uid: "1",
          not: false,
        },
        {
          type: "clause",
          relation: "r",
          source: "node",
          target: ":in title",
          uid: "2",
          not: false,
        },
      ],
      selections: [{ uid: "s1", text: "created", label: "Created" }],
      inputs: { title: "Graph" },
    });

    expect(built.query).toContain(":in $ ?title");
    expect(built.inputs).toEqual(["Graph"]);
    const formatted = await built.formatResult([
      { ":node/title": "A", ":block/uid": "u1" },
      { ":block/uid": "u1" },
      { ":create/time": "123" },
    ]);
    expect(formatted).toMatchObject({ text: "A", uid: "u1", Created: "123" });
  });

  it("adds internal find variables to the query output", async () => {
    const built = getDatalogQuery({
      conditions: [],
      selections: [],
      findVariables: [
        { label: "relationUid", variable: "condition-relSchema" },
        { label: "effectiveSource", variable: "?condition-relSource" },
      ],
    });

    expect(built.query).toContain("?condition-relSchema");
    expect(built.query).toContain("?condition-relSource");

    const formatted = await built.formatResult([
      { ":node/title": "A", ":block/uid": "u1" },
      { ":block/uid": "u1" },
      "rel-1",
      "source-1",
    ]);

    expect(formatted).toMatchObject({
      text: "A",
      uid: "u1",
      relationUid: "rel-1",
      effectiveSource: "source-1",
    });
  });
});

describe("fireQuery", () => {
  beforeEach(() => {
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        data: {
          async: {
            fast: {
              q: vi
                .fn()
                .mockResolvedValue([
                  [
                    { ":node/title": "Local", ":block/uid": "l1" },
                    { ":block/uid": "l1" },
                  ],
                ]),
            },
          },
          backend: {
            q: vi
              .fn()
              .mockResolvedValue([
                [
                  { ":node/title": "Remote", ":block/uid": "r1" },
                  { ":block/uid": "r1" },
                ],
              ]),
          },
          fast: {
            q: vi
              .fn()
              .mockReturnValue([
                [{ ":node/title": "Sync", ":block/uid": "s1" }],
              ]),
          },
        },
      },
    };
  });

  it("uses backend queries by default and maps output", async () => {
    const results = await fireQuery({ conditions: [], selections: [] });
    expect(results[0]).toMatchObject({ text: "Remote", uid: "r1" });
  });

  it("uses async fast query when local=true", async () => {
    const results = await fireQuery({
      conditions: [],
      selections: [],
      local: true,
    });
    expect(results[0]).toMatchObject({ text: "Local", uid: "l1" });
  });

  it("returns sync mapped results", () => {
    const results = fireQuerySync({ conditions: [], selections: [] });
    expect(results).toEqual([{ text: "Sync", uid: "s1" }]);
  });
});
