import { beforeEach, describe, expect, it, vi } from "vitest";
import matter from "gray-matter";
import { Notice, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { ImportableNode, RelationInstance } from "~/types";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import { getLoggedInClient, getSupabaseContext } from "../supabaseContext";
import { importSelectedNodes, refreshImportedFile } from "../importNodes";
import { loadRelations, saveRelations } from "../relationsStore";

vi.mock("../supabaseContext", () => ({
  getLoggedInClient: vi.fn(),
  getSupabaseContext: vi.fn(),
  getVaultId: () => "local-vault",
  getLocalSpaceUri: () => "obsidian:local-vault",
}));
vi.mock("../publishNode", () => ({
  publishNewRelation: vi.fn().mockResolvedValue(false),
}));
vi.mock("../templates", () => ({ createTemplateFile: vi.fn() }));
vi.mock("../importFolderMetadata", () => ({
  resolveFolderForSpaceUri: vi.fn().mockResolvedValue("import/Research"),
}));
vi.mock("../importRelations", () => ({
  importRelationsForImportedNodes: vi.fn().mockResolvedValue({ imported: 0 }),
}));

const REMOTE_URI = "https://roamresearch.com/#/app/research";
const evidenceRid = spaceUriAndLocalIdToRid(REMOTE_URI, "evidence", "note");
const sourceRid = spaceUriAndLocalIdToRid(REMOTE_URI, "source", "note");
const selectedNode: ImportableNode = {
  nodeInstanceId: "evidence",
  title: "Evidence title",
  spaceId: 2,
  spaceName: "Research",
  groupId: "group",
  selected: true,
};

type Row = Record<string, unknown>;
const createHarness = () => {
  const files = new Map<string, TFile>();
  const contents = new Map<string, string>();
  const schemas: Row[] = [
    {
      id: 10,
      space_id: 2,
      source_local_id: "evidence-type",
      name: "Evidence",
      is_schema: true,
      is_relation: false,
      literal_content: {},
    },
    {
      id: 11,
      space_id: 2,
      source_local_id: "source-type",
      name: "Source",
      is_schema: true,
      is_relation: false,
      literal_content: {},
    },
  ];
  const concepts: Row[] = [
    ...schemas,
    {
      id: 20,
      space_id: 2,
      source_local_id: "evidence",
      schema_id: 10,
      core_title: "Evidence title",
      sourceDocument: 21,
      is_schema: false,
      is_relation: false,
    },
    {
      id: 21,
      space_id: 2,
      source_local_id: "source",
      schema_id: 11,
      core_title: "Source title",
      sourceDocument: null,
      is_schema: false,
      is_relation: false,
    },
  ];
  const contentRows: Row[] = ["evidence", "source"].flatMap((id) => [
    {
      space_id: 2,
      source_local_id: id,
      variant: "direct",
      text: `${id} incoming title`,
      metadata: {},
      author_id: 1,
      created: "2026-09-01T00:00:00",
      last_modified: "2026-09-02T00:00:00",
    },
    {
      space_id: 2,
      source_local_id: id,
      variant: "full",
      text: `${id} body`,
      metadata: {},
      author_id: 1,
      created: "2026-09-01T00:00:00",
      last_modified: "2026-09-02T00:00:00",
    },
  ]);
  const spaces: Row[] = [
    { id: 1, url: "obsidian:local-vault", name: "Local" },
    { id: 2, url: REMOTE_URI, name: "Research" },
  ];
  const requests: {
    table: string;
    select: string;
    filters: [string, unknown][];
  }[] = [];
  let sourceQueryError = false;
  const from = vi.fn((table: string) => {
    const request = { table, select: "", filters: [] as [string, unknown][] };
    requests.push(request);
    const rows = (): Row[] => {
      const tableRows =
        table === "my_concepts"
          ? concepts
          : table === "my_contents" || table === "Content"
            ? contentRows
            : table === "my_spaces" || table === "Space"
              ? spaces
              : [];
      return tableRows.filter((row) =>
        request.filters.every(([key, value]) =>
          Array.isArray(value) ? value.includes(row[key]) : row[key] === value,
        ),
      );
    };
    const response = (single: boolean) => ({
      data: single ? (rows()[0] ?? null) : rows(),
      error:
        sourceQueryError &&
        table === "my_concepts" &&
        request.select === "id, source_local_id, space_id"
          ? { message: "Source lookup failed" }
          : null,
    });
    const query = {
      select: (columns: string) => {
        request.select = columns;
        return query;
      },
      eq: (key: string, value: unknown) => {
        request.filters.push([key, value]);
        return query;
      },
      in: (key: string, values: unknown[]) => {
        request.filters.push([key, values]);
        return query;
      },
      maybeSingle: () => Promise.resolve(response(true)),
      then: (resolve: (result: ReturnType<typeof response>) => unknown) =>
        Promise.resolve(response(false)).then(resolve),
    };
    return query;
  });
  const create = vi.fn((path: string, content: string) => {
    if (files.has(path))
      return Promise.reject(new Error(`File already exists: ${path}`));
    const file = new TFile();
    file.path = path;
    files.set(path, file);
    contents.set(path, content);
    return Promise.resolve(file);
  });
  const renameFile = vi.fn((file: TFile, newPath: string) => {
    const content = contents.get(file.path)!;
    files.delete(file.path);
    contents.delete(file.path);
    file.path = newPath;
    files.set(newPath, file);
    contents.set(newPath, content);
    return Promise.resolve();
  });
  const getFileCache = vi.fn((file: TFile) => ({
    frontmatter: matter(contents.get(file.path) ?? "").data,
  }));
  const saveSettings = vi.fn();
  const plugin = {
    app: {
      plugins: { plugins: {} },
      vault: {
        create,
        getFileByPath: (path: string) => files.get(path) ?? null,
        getAbstractFileByPath: (path: string) => files.get(path) ?? null,
        getMarkdownFiles: () =>
          [...files.values()].filter((file) => file.extension === "md"),
        read: (file: TFile) => Promise.resolve(contents.get(file.path)!),
        modify: (file: TFile, content: string) => {
          contents.set(file.path, content);
          return Promise.resolve();
        },
        process: (file: TFile, callback: (content: string) => string) => {
          contents.set(file.path, callback(contents.get(file.path)!));
          return Promise.resolve();
        },
        createFolder: vi.fn(),
        adapter: { exists: (path: string) => Promise.resolve(files.has(path)) },
      },
      metadataCache: { getFileCache, getFirstLinkpathDest: () => null },
      fileManager: {
        renameFile,
        processFrontMatter: (
          file: TFile,
          callback: (frontmatter: Row) => void,
        ) => {
          const parsed = matter(contents.get(file.path)!);
          callback(parsed.data);
          contents.set(
            file.path,
            matter.stringify(parsed.content, parsed.data),
          );
          return Promise.resolve();
        },
      },
    },
    settings: {
      nodeTypes: [
        {
          id: "evidence-type",
          name: "Evidence",
          format: "EVD - {content}",
          created: 0,
          modified: 0,
        },
        {
          id: "source-type",
          name: "Source",
          format: "SRC - {content}",
          created: 0,
          modified: 0,
        },
      ],
      relationTypes: [
        {
          id: "based-on",
          label: "Based on",
          complement: "Source of",
          color: "black",
          created: 0,
          modified: 0,
        },
      ],
      discourseRelations: [
        {
          id: "evidence-source",
          sourceId: "evidence-type",
          destinationId: "source-type",
          relationshipTypeId: "based-on",
          created: 0,
          modified: 0,
        },
      ],
    },
    saveSettings,
  } as unknown as DiscourseGraphPlugin;
  vi.mocked(getLoggedInClient).mockResolvedValue({
    from,
  } as unknown as DGSupabaseClient);
  vi.mocked(getSupabaseContext).mockResolvedValue({
    spaceId: 1,
    platform: "Obsidian",
    userId: 1,
    spacePassword: "test",
  });
  const pull = () =>
    importSelectedNodes({ plugin, selectedNodes: [selectedNode] });
  const seedSource = async (local = false): Promise<TFile> =>
    create(
      "My existing source.md",
      matter.stringify("Original source body", {
        nodeInstanceId: "source",
        nodeTypeId: "source-type",
        ...(local ? {} : { importedFromRid: sourceRid }),
      }),
    );
  return {
    plugin,
    saveSettings,
    concepts,
    contentRows,
    requests,
    files,
    contents,
    create,
    renameFile,
    getFileCache,
    pull,
    seedSource,
    failSourceQuery: () => {
      sourceQueryError = true;
    },
  };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("source document import", () => {
  it("imports an available Source and creates one local relation", async () => {
    const h = createHarness();
    expect(await h.pull()).toEqual({ success: 1, failed: 0 });
    expect([...h.files.keys()]).toContain(
      "import/Research/SRC - Source title.md",
    );
    expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual([
      expect.objectContaining({
        type: "based-on",
        source: evidenceRid,
        destination: sourceRid,
      }),
    ]);
    expect(Notice).not.toHaveBeenCalled();
    expect(
      h.requests.find(
        (request) => request.select === "id, source_local_id, space_id",
      )?.filters,
    ).toEqual([
      ["is_schema", false],
      ["is_relation", false],
      ["id", [21]],
    ]);
  });

  it.each([false, true])(
    "reuses an existing Source (local=%s)",
    async (local) => {
      const h = createHarness();
      if (local) h.concepts.find((row) => row.id === 21)!.space_id = 1;
      const sourceFile = await h.seedSource(local);
      const original = h.contents.get(sourceFile.path);
      await h.pull();
      expect(h.contents.get(sourceFile.path)).toBe(original);
      expect(
        [...h.files.values()].filter((file) => file.extension === "md"),
      ).toHaveLength(2);
      expect(
        Object.values((await loadRelations(h.plugin)).relations)[0]
          ?.destination,
      ).toBe(local ? "source" : sourceRid);
      expect(
        h.requests.filter((request) => request.table === "my_contents"),
      ).toHaveLength(1);
    },
  );

  it.each(["triple", "type"])(
    "imports the Source without creating a missing relation %s",
    async (missing) => {
      const h = createHarness();
      if (missing === "triple") h.plugin.settings.discourseRelations = [];
      else h.plugin.settings.relationTypes = [];
      const settings = structuredClone(h.plugin.settings);
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
      expect(
        [...h.files.values()].filter((file) => file.extension === "md"),
      ).toHaveLength(2);
      expect((await loadRelations(h.plugin)).relations).toEqual({});
      expect(h.plugin.settings).toEqual(settings);
      expect(h.saveSettings).not.toHaveBeenCalled();
    },
  );

  it.each(["triple", "type"])(
    "does not materialize a relation through a provisional %s",
    async (provisional) => {
      const h = createHarness();
      const schema =
        provisional === "triple"
          ? h.plugin.settings.discourseRelations[0]!
          : h.plugin.settings.relationTypes[0]!;
      schema.importedFromRid = "orn:obsidian.schema:remote/relation-type";
      schema.status = "provisional";
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
      expect(
        [...h.files.values()].filter((file) => file.extension === "md"),
      ).toHaveLength(2);
      expect((await loadRelations(h.plugin)).relations).toEqual({});
      schema.status = "accepted";
      await h.pull();
      expect(
        Object.values((await loadRelations(h.plugin)).relations),
      ).toHaveLength(1);
    },
  );

  it("does nothing when the current node has no source value", async () => {
    const h = createHarness();
    h.concepts.find((row) => row.id === 20)!.sourceDocument = null;
    expect(await h.pull()).toEqual({ success: 1, failed: 0 });
    expect(h.files.size).toBe(1);
    expect(
      h.requests.some(
        (request) => request.select === "id, source_local_id, space_id",
      ),
    ).toBe(false);
    expect(Notice).not.toHaveBeenCalled();
  });

  it.each(["not-shared", "no-content", "query-error"])(
    "keeps the current node when the Source is unavailable: %s",
    async (reason) => {
      const h = createHarness();
      if (reason === "not-shared")
        h.concepts.splice(
          h.concepts.findIndex((row) => row.id === 21),
          1,
        );
      if (reason === "no-content") h.contentRows.splice(2);
      if (reason === "query-error") h.failSourceQuery();
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
      expect([...h.files.keys()]).toEqual([
        "import/Research/EVD - Evidence title.md",
      ]);
      expect((await loadRelations(h.plugin)).relations).toEqual({});
      expect(Notice).toHaveBeenCalledWith(expect.stringMatching(/source/i));
      expect(console.warn).toHaveBeenCalled();
    },
  );

  it("repeated pull and refresh reuse both nodes and the relation without renaming", async () => {
    const h = createHarness();
    await h.pull();
    const firstRelations = await loadRelations(h.plugin);
    const paths = [...h.files.keys()];
    await h.pull();
    const file = h.files.get("import/Research/EVD - Evidence title.md")!;
    expect(await refreshImportedFile({ plugin: h.plugin, file })).toEqual({
      success: true,
      error: undefined,
    });
    expect([...h.files.keys()]).toEqual(paths);
    expect(await loadRelations(h.plugin)).toEqual(firstRelations);
    expect(h.renameFile).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "reuses a manually created relation (local RIDs=%s)",
    async (localRids) => {
      const h = createHarness();
      await h.seedSource();
      const relation: RelationInstance = {
        id: "manual",
        type: "based-on",
        source: localRids
          ? spaceUriAndLocalIdToRid("obsidian:local-vault", "evidence", "note")
          : "evidence",
        destination: localRids
          ? spaceUriAndLocalIdToRid("obsidian:local-vault", "source", "note")
          : "source",
        created: 1,
      };
      await saveRelations(h.plugin, {
        version: 1,
        lastModified: 1,
        relations: { manual: relation },
      });
      await h.pull();
      expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual([
        relation,
      ]);
    },
  );

  it("shares one Source across a batch even while the metadata cache is empty", async () => {
    const h = createHarness();
    h.getFileCache.mockReturnValue({ frontmatter: {} });
    const evidence = h.concepts.find((row) => row.id === 20)!;
    h.concepts.push({
      ...evidence,
      id: 22,
      source_local_id: "second",
      core_title: "Second evidence",
    });
    h.contentRows.push(
      ...h.contentRows
        .slice(0, 2)
        .map((row) => ({ ...row, source_local_id: "second" })),
    );
    expect(
      await importSelectedNodes({
        plugin: h.plugin,
        selectedNodes: [
          selectedNode,
          { ...selectedNode, nodeInstanceId: "second" },
        ],
      }),
    ).toEqual({ success: 2, failed: 0 });
    expect(
      [...h.files.values()].filter((file) => file.extension === "md"),
    ).toHaveLength(3);
    expect(
      Object.values((await loadRelations(h.plugin)).relations),
    ).toHaveLength(2);
    expect(
      h.create.mock.calls.filter(([path]) => path.includes("SRC -")),
    ).toHaveLength(1);
  });

  it("keeps distinct same-titled Sources and their relations through repeated pulls", async () => {
    const h = createHarness();
    h.concepts.push(
      {
        ...h.concepts.find((row) => row.id === 20)!,
        id: 22,
        source_local_id: "second-evidence",
        core_title: "Second evidence",
        sourceDocument: 23,
      },
      {
        ...h.concepts.find((row) => row.id === 21)!,
        id: 23,
        source_local_id: "second-source",
      },
    );
    h.contentRows.push(
      ...h.contentRows.map((row) => ({
        ...row,
        source_local_id: `second-${String(row.source_local_id)}`,
        text: `Second ${String(row.text)}`,
      })),
    );
    const pull = () =>
      importSelectedNodes({
        plugin: h.plugin,
        selectedNodes: [
          selectedNode,
          { ...selectedNode, nodeInstanceId: "second-evidence" },
        ],
      });
    expect(await pull()).toEqual({ success: 2, failed: 0 });
    const sources = [...h.files.values()].filter(
      (file) =>
        matter(h.contents.get(file.path)!).data.nodeTypeId === "source-type",
    );
    expect(sources).toHaveLength(2);
    const sourceContents = sources.map((file) => h.contents.get(file.path)!);
    expect(
      sourceContents.some(
        (content) => matter(content).content.trim() === "source body",
      ),
    ).toBe(true);
    expect(
      sourceContents.some(
        (content) => matter(content).content.trim() === "Second source body",
      ),
    ).toBe(true);
    const relations = Object.values((await loadRelations(h.plugin)).relations);
    expect(relations).toHaveLength(2);
    expect(new Set(relations.map((relation) => relation.destination))).toEqual(
      new Set(
        sourceContents.map((content) =>
          String(matter(content).data.importedFromRid),
        ),
      ),
    );
    const paths = [...h.files.keys()];
    await pull();
    await refreshImportedFile({ plugin: h.plugin, file: sources[1]! });
    await pull();
    expect([...h.files.keys()]).toEqual(paths);
    expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual(
      relations,
    );
    expect(h.renameFile).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "resolves a local Source despite a same-ID import (Datacore=%s)",
    async (datacore) => {
      const h = createHarness();
      h.concepts.find((row) => row.id === 21)!.space_id = 1;
      await h.seedSource();
      const localSource = await h.create(
        "Local source.md",
        matter.stringify("Local source", {
          nodeInstanceId: "source",
          nodeTypeId: "source-type",
        }),
      );
      if (datacore)
        Object.assign(h.plugin.app, {
          plugins: {
            plugins: {
              datacore: {
                api: {
                  query: (query: string) =>
                    [...h.files.values()]
                      .filter((file) => {
                        const frontmatter = matter(
                          h.contents.get(file.path)!,
                        ).data;
                        return (
                          file.extension === "md" &&
                          [
                            ...query.matchAll(
                              /(nodeInstanceId|importedFromRid) = "([^"]+)"/g,
                            ),
                          ].every(
                            ([, key, value]) => frontmatter[key!] === value,
                          )
                        );
                      })
                      .map((file) => ({ $path: file.path })),
                },
              },
            },
          },
        });
      await h.pull();
      expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual([
        expect.objectContaining({ source: evidenceRid, destination: "source" }),
      ]);
      expect(h.contents.get(localSource.path)).toContain("Local source");
    },
  );

  it.each([false, true])(
    "does not confuse same-ID local and imported relations (local RIDs=%s)",
    async (localRids) => {
      const h = createHarness();
      for (const id of ["evidence", "source"]) {
        await h.create(
          `Local ${id}.md`,
          matter.stringify(`Local ${id} body`, {
            nodeInstanceId: id,
            nodeTypeId: `${id}-type`,
          }),
        );
      }
      const manual: RelationInstance = {
        id: "local-relation",
        type: "based-on",
        source: localRids
          ? spaceUriAndLocalIdToRid("obsidian:local-vault", "evidence", "note")
          : "evidence",
        destination: localRids
          ? spaceUriAndLocalIdToRid("obsidian:local-vault", "source", "note")
          : "source",
        created: 1,
      };
      await saveRelations(h.plugin, {
        version: 1,
        lastModified: 1,
        relations: { [manual.id]: manual },
      });
      await h.pull();
      await h.pull();
      expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual([
        manual,
        expect.objectContaining({
          source: evidenceRid,
          destination: sourceRid,
        }),
      ]);
    },
  );
});
