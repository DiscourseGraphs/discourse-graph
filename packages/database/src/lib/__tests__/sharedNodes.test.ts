import { describe, expect, it } from "vitest";
import {
  buildSharedNodeCandidates,
  buildSharedNodePayload,
} from "../sharedNodes";

type BuildArgs = Parameters<typeof buildSharedNodeCandidates>[0];

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
    last_modified: "2026-06-14T12:00:00.000Z",
    schema_id: 200,
    source_local_id: "node-1",
    space_id: 20,
  },
];
const contents: BuildArgs["contents"] = [
  {
    author_id: 42,
    content_type: "text/plain",
    created: "2026-06-14T11:00:00.000Z",
    last_modified: "2026-06-14T13:00:00.000Z",
    metadata: { source: "obsidian" },
    source_local_id: "node-1",
    space_id: 20,
    text: "EVD - REM sleep and recall",
    variant: "direct",
  },
  {
    author_id: null,
    content_type: "text/markdown",
    created: null,
    last_modified: "2026-06-14T15:00:00.000Z",
    metadata: null,
    source_local_id: "node-1",
    space_id: 20,
    text: "# EVD - REM sleep and recall",
    variant: "full",
  },
];
const rid = "orn:obsidian.note:vault-a/node-1";

const build = ({
  conceptsOverride = concepts,
  contentsOverride = contents,
  currentSpaceId = 10,
  resourcesOverride = resources,
  spacesOverride = spaces,
}: {
  conceptsOverride?: typeof concepts;
  contentsOverride?: typeof contents;
  currentSpaceId?: number;
  resourcesOverride?: typeof resources;
  spacesOverride?: typeof spaces;
} = {}) =>
  buildSharedNodeCandidates({
    concepts: conceptsOverride,
    contents: contentsOverride,
    currentSpaceId,
    resources: resourcesOverride,
    spaces: spacesOverride,
  });

describe("buildSharedNodeCandidates", () => {
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
      conceptsOverride: [{ ...concepts[0]!, is_schema: true }],
      contentsOverride: contents,
    },
    {
      name: "missing node type",
      conceptsOverride: [{ ...concepts[0]!, schema_id: null }],
      contentsOverride: contents,
    },
    {
      name: "missing direct content",
      conceptsOverride: concepts,
      contentsOverride: [contents[1]!],
    },
    {
      name: "missing full content",
      conceptsOverride: concepts,
      contentsOverride: [contents[0]!],
    },
    {
      name: "untyped full content",
      conceptsOverride: concepts,
      contentsOverride: [contents[0]!, { ...contents[1]!, content_type: null }],
    },
  ])("filters a node with $name", ({ conceptsOverride, contentsOverride }) => {
    expect(build({ conceptsOverride, contentsOverride })).toEqual([]);
  });

  it("sorts newest nodes first", () => {
    const olderConcept = {
      ...concepts[0]!,
      last_modified: "2026-06-10T12:00:00.000Z",
      source_local_id: "node-2",
    };
    const olderContents = contents.map((content) => ({
      ...content,
      last_modified: "2026-06-10T12:00:00.000Z",
      source_local_id: "node-2",
      text:
        content.variant === "direct"
          ? "Older shared node"
          : "# Older shared node",
    }));
    expect(
      build({
        conceptsOverride: [olderConcept, concepts[0]!],
        contentsOverride: [...olderContents, ...contents],
        resourcesOverride: [
          ...resources,
          { space_id: 20, source_local_id: "node-2" },
        ],
      }).map((node) => node.sourceLocalId),
    ).toEqual(["node-1", "node-2"]);
  });
});

describe("buildSharedNodePayload", () => {
  const concept = {
    author_id: 42,
    created: "2026-06-14T10:00:00.000Z",
    last_modified: "2026-06-14T12:00:00.000Z",
    schema_id: 200,
    source_local_id: "node-1",
  };

  it("builds the CrossAppNode consumed by the Roam materializer", () => {
    expect(buildSharedNodePayload({ concept, contents })).toEqual({
      author: { dbId: 42 },
      content: {
        direct: {
          contentType: "text/plain",
          value: "EVD - REM sleep and recall",
        },
        full: {
          contentType: "text/markdown",
          value: "# EVD - REM sleep and recall",
        },
      },
      createdAt: new Date("2026-06-14T10:00:00.000Z"),
      localId: "node-1",
      modifiedAt: new Date("2026-06-14T15:00:00.000Z"),
      nodeType: { dbId: 200 },
    });
  });

  it("rejects an incomplete payload before it reaches the materializer", () => {
    expect(() =>
      buildSharedNodePayload({
        concept,
        contents: contents.filter((content) => content.variant !== "full"),
      }),
    ).toThrow("Shared node is missing its full content");
  });

  it("uses the modified time when the source has no created time", () => {
    const payload = buildSharedNodePayload({
      concept: { ...concept, created: null },
      contents: contents.map((content) => ({ ...content, created: null })),
    });

    expect(payload.createdAt).toEqual(new Date("2026-06-14T15:00:00.000Z"));
  });
});
