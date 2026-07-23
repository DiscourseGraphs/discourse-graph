import { describe, expect, it } from "vitest";
import { buildSharedNodes } from "../sharedNodes";

type BuildArgs = Parameters<typeof buildSharedNodes>[0];

const spaces: BuildArgs["spaces"] = [
  {
    id: 20,
    name: "Research vault",
    platform: "Obsidian",
    url: "obsidian:vault-a",
  },
];
const nodes: BuildArgs["nodes"] = [
  {
    is_schema: false,
    last_modified: "2026-06-14T12:00:00",
    schema_id: 200,
    source_local_id: "node-1",
    space_id: 20,
  },
];
const directContents: BuildArgs["directContents"] = [
  {
    author_id: 42,
    created: "2026-06-14T11:00:00",
    last_modified: "2026-06-14T13:00:00",
    metadata: { source: "obsidian" },
    source_local_id: "node-1",
    space_id: 20,
    text: "EVD - REM sleep and recall",
    variant: "direct",
  },
];
const fullContentSummaries: BuildArgs["fullContentSummaries"] = [
  {
    last_modified: "2026-06-14T15:00:00",
    source_local_id: "node-1",
    space_id: 20,
  },
];
const rid = "orn:obsidian.note:vault-a/node-1";

const build = ({
  nodesOverride = nodes,
  directOverride = directContents,
  fullOverride = fullContentSummaries,
  spacesOverride = spaces,
}: {
  nodesOverride?: typeof nodes;
  directOverride?: typeof directContents;
  fullOverride?: typeof fullContentSummaries;
  spacesOverride?: typeof spaces;
} = {}) =>
  buildSharedNodes({
    nodes: nodesOverride,
    directContents: directOverride,
    fullContentSummaries: fullOverride,
    spaces: spacesOverride,
  });

describe("buildSharedNodes", () => {
  it("builds a group-shared contract node with stable source identity", () => {
    expect(build()).toEqual([
      {
        rid,
        sourceLocalId: "node-1",
        spaceId: 20,
        spaceName: "Research vault",
        spaceUri: "obsidian:vault-a",
        platform: "Obsidian",
        title: "EVD - REM sleep and recall",
        created: "2026-06-14T11:00:00.000Z",
        lastModified: "2026-06-14T15:00:00.000Z",
        authorId: 42,
        directMetadata: { source: "obsidian" },
      },
    ]);
  });

  it("discovers a node without full content", () => {
    expect(build({ fullOverride: [] })[0]?.lastModified).toBe(
      "2026-06-14T13:00:00.000Z",
    );
  });

  it("falls back to the direct created date when no last-modified exists", () => {
    expect(
      build({
        nodesOverride: [{ ...nodes[0]!, last_modified: null }],
        directOverride: [{ ...directContents[0]!, last_modified: null }],
        fullOverride: [],
      })[0]?.lastModified,
    ).toBe("2026-06-14T11:00:00.000Z");
  });

  it.each([
    {
      name: "schema concept",
      nodesOverride: [{ ...nodes[0]!, is_schema: true }],
      directOverride: directContents,
    },
    {
      name: "missing node type",
      nodesOverride: [{ ...nodes[0]!, schema_id: null }],
      directOverride: directContents,
    },
    {
      name: "missing direct content",
      nodesOverride: nodes,
      directOverride: [],
    },
  ])("filters a node with $name", ({ nodesOverride, directOverride }) => {
    expect(build({ nodesOverride, directOverride })).toEqual([]);
  });

  it("sorts newest nodes first", () => {
    const olderNode = {
      ...nodes[0]!,
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
    };
    const olderDirect = {
      ...directContents[0]!,
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
      text: "Older shared node",
    };
    expect(
      build({
        nodesOverride: [olderNode, nodes[0]!],
        directOverride: [olderDirect, ...directContents],
        fullOverride: fullContentSummaries,
      }).map((node) => node.sourceLocalId),
    ).toEqual(["node-1", "node-2"]);
  });
});
