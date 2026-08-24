import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

const mocks = vi.hoisted(() => {
  const generateUID = vi.fn(() => "generated-uid");
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      util: {
        generateUID,
      },
    },
  };
  return {
    isNewSettingsStoreEnabled: vi.fn(),
    getAllDiscourseNodes: vi.fn(),
  };
});

vi.mock("~/components/settings/utils/accessors", () => ({
  isNewSettingsStoreEnabled: mocks.isNewSettingsStoreEnabled,
  getAllDiscourseNodes: mocks.getAllDiscourseNodes,
}));

import getDiscourseNodes, {
  excludeDefaultNodes,
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

describe("getDiscourseNodes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNewSettingsStoreEnabled.mockReturnValue(true);
  });

  it("excludes default Page, Block, and synthetic Any from relation endpoint types", () => {
    mocks.getAllDiscourseNodes.mockReturnValue([
      makeUserNode({ text: "Claim", type: "CLM" }),
      makeUserNode({ text: "Evidence", type: "EVD" }),
    ]);

    const discourseNodes = getDiscourseNodes();
    expect(discourseNodes.map((n) => n.type)).toEqual([
      "CLM",
      "EVD",
      "page-node",
      "blck-node",
    ]);

    const endpointTypes = discourseNodes
      .filter(excludeDefaultNodes)
      .map((n) => n.type);
    expect(endpointTypes).toEqual(["CLM", "EVD"]);
    expect(endpointTypes).not.toContain("page-node");
    expect(endpointTypes).not.toContain("blck-node");
    expect(endpointTypes).not.toContain("*");
  });

  it("keeps a user-configured node that shares a default node's name", () => {
    mocks.getAllDiscourseNodes.mockReturnValue([
      makeUserNode({ text: "Page", type: "user-page-node" }),
    ]);

    const discourseNodes = getDiscourseNodes();
    expect(discourseNodes.map((n) => n.type)).toEqual([
      "user-page-node",
      "blck-node",
    ]);

    const endpointTypes = discourseNodes
      .filter(excludeDefaultNodes)
      .map((n) => n.type);
    expect(endpointTypes).toEqual(["user-page-node"]);
  });
});
