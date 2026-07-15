import { describe, expect, it } from "vitest";
import { buildDiscoveredSharedNodes } from "~/utils/discoverSharedNodes";

type BuildArgs = Parameters<typeof buildDiscoveredSharedNodes>[0];

const resources: BuildArgs["resources"] = [
  { space_id: 20, source_local_id: "node-1" },
  { space_id: 20, source_local_id: "schema-1" },
];
const spaces: BuildArgs["spaces"] = [
  {
    id: 20,
    name: "Research vault",
    platform: "Obsidian",
    url: "obsidian:vault-a",
  },
];
const concepts: BuildArgs["concepts"] = [
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
    last_modified: "2026-06-14T13:00:00",
    source_local_id: "node-1",
    space_id: 20,
    text: "EVD - REM sleep and recall",
  },
];
const fullContentSummaries: BuildArgs["fullContentSummaries"] = [
  {
    content_type: "text/markdown",
    last_modified: "2026-06-14T15:00:00",
    source_local_id: "node-1",
    space_id: 20,
  },
];
const sourceNodeRid = "orn:obsidian.note:vault-a/node-1";

const build = ({
  conceptsOverride = concepts,
  directContentsOverride = directContents,
  fullContentSummariesOverride = fullContentSummaries,
  currentSpaceId = 10,
  importedSourceRids = new Set<string>(),
  resourcesOverride = resources,
  spacesOverride = spaces,
}: {
  conceptsOverride?: typeof concepts;
  directContentsOverride?: typeof directContents;
  fullContentSummariesOverride?: typeof fullContentSummaries;
  currentSpaceId?: number;
  importedSourceRids?: ReadonlySet<string>;
  resourcesOverride?: typeof resources;
  spacesOverride?: typeof spaces;
} = {}) =>
  buildDiscoveredSharedNodes({
    concepts: conceptsOverride,
    directContents: directContentsOverride,
    fullContentSummaries: fullContentSummariesOverride,
    currentSpaceId,
    importedSourceRids,
    resources: resourcesOverride,
    spaces: spacesOverride,
  });

describe("buildDiscoveredSharedNodes", () => {
  it("builds a group-shared contract node with stable source identity", () => {
    expect(build({ importedSourceRids: new Set([sourceNodeRid]) })).toEqual([
      {
        alreadyImported: true,
        modifiedAt: "2026-06-14T15:00:00.000Z",
        sourceApp: "Obsidian",
        sourceNodeId: "node-1",
        sourceNodeRid,
        sourceSpaceId: "obsidian:vault-a",
        sourceSpaceName: "Research vault",
        title: "EVD - REM sleep and recall",
      },
    ]);
  });

  it("does not discover shared resources from the current space", () => {
    expect(build({ currentSpaceId: 20 })).toEqual([]);
  });

  it("requires the exact shared resource identity", () => {
    expect(
      build({
        resourcesOverride: [{ space_id: 21, source_local_id: "node-1" }],
      }),
    ).toEqual([]);
  });

  it.each([
    {
      name: "schema concept",
      conceptsOverride: [{ ...concepts[0], is_schema: true }],
      directContentsOverride: directContents,
      fullContentSummariesOverride: fullContentSummaries,
    },
    {
      name: "missing node type",
      conceptsOverride: [{ ...concepts[0], schema_id: null }],
      directContentsOverride: directContents,
      fullContentSummariesOverride: fullContentSummaries,
    },
    {
      name: "missing direct content",
      conceptsOverride: concepts,
      directContentsOverride: [],
      fullContentSummariesOverride: fullContentSummaries,
    },
    {
      name: "untyped full content",
      conceptsOverride: concepts,
      directContentsOverride: directContents,
      fullContentSummariesOverride: [
        { ...fullContentSummaries[0], content_type: null },
      ],
    },
  ])(
    "filters a node with $name",
    ({
      conceptsOverride,
      directContentsOverride,
      fullContentSummariesOverride,
    }) => {
      expect(
        build({
          conceptsOverride,
          directContentsOverride,
          fullContentSummariesOverride,
        }),
      ).toEqual([]);
    },
  );

  it("discovers a node without optional full content", () => {
    expect(build({ fullContentSummariesOverride: [] })).toMatchObject([
      {
        modifiedAt: "2026-06-14T13:00:00.000Z",
        sourceNodeRid,
        title: "EVD - REM sleep and recall",
      },
    ]);
  });

  it("matches imports by RID rather than source-local ID alone", () => {
    expect(
      build({
        importedSourceRids: new Set(["orn:obsidian.note:another-vault/node-1"]),
      })[0]?.alreadyImported,
    ).toBe(false);
  });

  it.each([
    "orn:obsidian.note:vault-a/node-1",
    "https://example.com/shared/node-1",
  ])("preserves a RID-shaped source-local ID: %s", (rid) => {
    expect(
      build({
        conceptsOverride: [{ ...concepts[0], source_local_id: rid }],
        directContentsOverride: [
          { ...directContents[0], source_local_id: rid },
        ],
        fullContentSummariesOverride: [
          { ...fullContentSummaries[0], source_local_id: rid },
        ],
        resourcesOverride: [{ space_id: 20, source_local_id: rid }],
      })[0]?.sourceNodeRid,
    ).toBe(rid);
  });

  it("sorts newest nodes first", () => {
    const olderConcept = {
      ...concepts[0],
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
    };
    const olderDirectContent = {
      ...directContents[0],
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
      text: "Older shared node",
    };
    const olderFullContentSummary = {
      ...fullContentSummaries[0],
      last_modified: "2026-06-10T12:00:00",
      source_local_id: "node-2",
    };
    expect(
      build({
        conceptsOverride: [olderConcept, concepts[0]],
        directContentsOverride: [olderDirectContent, ...directContents],
        fullContentSummariesOverride: [
          olderFullContentSummary,
          ...fullContentSummaries,
        ],
        resourcesOverride: [
          ...resources,
          { space_id: 20, source_local_id: "node-2" },
        ],
      }).map((node) => node.sourceNodeId),
    ).toEqual(["node-1", "node-2"]);
  });
});
