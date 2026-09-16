import { vi } from "vitest";
import matter from "gray-matter";
import { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { ImportableNode } from "~/types";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import { getLoggedInClient, getSupabaseContext } from "../supabaseContext";
import { importSelectedNodes } from "../importNodes";

export const REMOTE_URI = "https://roamresearch.com/#/app/research";
export const evidenceRid = spaceUriAndLocalIdToRid(
  REMOTE_URI,
  "evidence",
  "note",
);
export const sourceRid = spaceUriAndLocalIdToRid(REMOTE_URI, "source", "note");
export const selectedNode: ImportableNode = {
  nodeInstanceId: "evidence",
  title: "Evidence title",
  spaceId: 2,
  spaceName: "Research",
  groupId: "group",
  selected: true,
};

type Row = Record<string, unknown>;
export const createHarness = () => {
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
