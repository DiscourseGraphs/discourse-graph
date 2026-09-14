import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

vi.hoisted(() => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      util: {
        generateUID: () => "generated-uid",
      },
    },
  };
});

const mocks = vi.hoisted(() => ({
  isNewSettingsStoreEnabled: vi.fn(),
  getAllDiscourseNodes: vi.fn(),
}));

vi.mock("~/components/settings/utils/accessors", () => ({
  isNewSettingsStoreEnabled: mocks.isNewSettingsStoreEnabled,
  getAllDiscourseNodes: mocks.getAllDiscourseNodes,
}));

import getDiscourseNodes, {
  getRelationEndpointNodeTypes,
} from "~/utils/getDiscourseNodes";

const makeUserNode = ({
  text,
  type,
}: {
  text: string;
  type: string;
}): DiscourseNode => ({
  text,
  type,
  shortcut: "",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "{content}",
});

describe("getRelationEndpointNodeTypes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNewSettingsStoreEnabled.mockReturnValue(true);
  });

  it("excludes default Page and Block nodes while keeping user-configured types", () => {
    mocks.getAllDiscourseNodes.mockReturnValue([
      makeUserNode({ text: "Claim", type: "CLM" }),
      makeUserNode({ text: "Evidence", type: "EVD" }),
    ]);

    const discourseNodes = getDiscourseNodes();
    expect(discourseNodes.map((n) => n.type)).toEqual(
      expect.arrayContaining(["page-node", "blck-node"]),
    );

    expect(getRelationEndpointNodeTypes(discourseNodes)).toEqual([
      "CLM",
      "EVD",
    ]);
  });

  it("keeps a user-configured node that shares a default node's name", () => {
    mocks.getAllDiscourseNodes.mockReturnValue([
      makeUserNode({ text: "Page", type: "user-page-node" }),
    ]);

    expect(getRelationEndpointNodeTypes(getDiscourseNodes())).toEqual([
      "user-page-node",
    ]);
  });
});
