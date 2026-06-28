import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import type { DiscourseRelation } from "~/utils/getDiscourseRelations";

const mocks = vi.hoisted(() => ({
  findDiscourseNode: vi.fn(),
  fireQuery: vi.fn(),
  generateUID: vi.fn(),
  getSetting: vi.fn(),
}));

vi.mock("~/utils/deriveDiscourseNodeAttribute", () => ({
  ANY_RELATION_NAME: "Has Any Relation To",
  ANY_RELATION_REGEX: /Has Any Relation To/i,
}));

vi.mock("~/utils/extensionSettings", () => ({
  getSetting: mocks.getSetting,
}));

vi.mock("~/utils/findDiscourseNode", () => ({
  default: mocks.findDiscourseNode,
}));

vi.mock("~/utils/fireQuery", () => ({
  default: mocks.fireQuery,
}));

vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => [],
}));

vi.mock("~/utils/getDiscourseRelations", () => ({
  default: () => [],
}));

import getDiscourseContextResults from "~/utils/getDiscourseContextResults";

const makeNode = ({
  type,
  text,
}: {
  type: string;
  text: string;
}): DiscourseNode => ({
  type,
  text,
  shortcut: "",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "{content}",
});

describe("getDiscourseContextResults", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        util: {
          generateUID: mocks.generateUID,
        },
      },
    };

    mocks.generateUID.mockReturnValue("condition");
    mocks.getSetting.mockReturnValue(true);
    mocks.findDiscourseNode.mockReturnValue({ type: "CLM" });
  });

  it("regroups all-relation reified query results by relation direction", async () => {
    const onResult = vi.fn();
    const nodes: DiscourseNode[] = [
      makeNode({ type: "CLM", text: "Claim" }),
      makeNode({ type: "QUE", text: "Question" }),
      makeNode({ type: "EVD", text: "Evidence" }),
    ];
    const relations: DiscourseRelation[] = [
      {
        id: "supports",
        label: "Supports",
        complement: "Supported By",
        source: "CLM",
        destination: "QUE",
        triples: [],
      },
      {
        id: "informs",
        label: "Informs",
        complement: "Informed By",
        source: "EVD",
        destination: "CLM",
        triples: [],
      },
    ];

    mocks.fireQuery.mockResolvedValue([
      {
        text: "Question A",
        uid: "question-a",
        relationUid: "supports",
        effectiveSource: "claim-a",
      },
      {
        text: "Evidence A",
        uid: "evidence-a",
        relationUid: "informs",
        effectiveSource: "evidence-a",
      },
    ]);

    const results = await getDiscourseContextResults({
      uid: "claim-a",
      nodes,
      relations,
      onResult,
    });

    expect(mocks.fireQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        returnNode: "Any",
        selections: [],
        findVariables: [
          { label: "relationUid", variable: "condition-relSchema" },
          { label: "effectiveSource", variable: "condition-relSource" },
        ],
      }),
    );

    expect(results[0]).toEqual({
      label: "Supports",
      results: {
        "question-a": {
          text: "Question A",
          uid: "question-a",
          relationUid: "supports",
          effectiveSource: "claim-a",
          target: "Question",
          complement: 0,
          id: "supports",
          ctxTargetUid: "claim-a",
        },
      },
    });
    expect(results[1]).toEqual({
      label: "Informed By",
      results: {
        "evidence-a": {
          text: "Evidence A",
          uid: "evidence-a",
          relationUid: "informs",
          effectiveSource: "evidence-a",
          target: "Evidence",
          complement: 1,
          id: "informs",
          ctxTargetUid: "claim-a",
        },
      },
    });
    expect(onResult).toHaveBeenNthCalledWith(1, results[0]);
    expect(onResult).toHaveBeenNthCalledWith(2, results[1]);
  });
});
