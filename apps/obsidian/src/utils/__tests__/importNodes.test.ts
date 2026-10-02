import { describe, expect, it } from "vitest";
import { TFile, TFolder, type App } from "obsidian";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type DiscourseGraphPlugin from "~/index";
import {
  getUntitledTemplateFileName,
  mapNodeTypeIdToLocal,
} from "~/utils/importNodes";

const TEMPLATES_FOLDER = "Templates";
const SOURCE_SPACE_NAME = "my-graph";

describe("getUntitledTemplateFileName", () => {
  it("names the file after the node type and its source space", () => {
    expect(
      getUntitledTemplateFileName({
        nodeTypeName: "Evidence",
        sourceSpaceName: SOURCE_SPACE_NAME,
      }),
    ).toBe("Evidence (from my-graph)");
  });

  it("removes the characters Obsidian rejects in file names", () => {
    expect(
      getUntitledTemplateFileName({
        nodeTypeName: 'Q: "Why"? <a|b> *c* d/e\\f',
        sourceSpaceName: "graph:1",
      }),
    ).toBe("Q Why ab c def (from graph1)");
  });

  it("falls back to a generic name when no valid character remains", () => {
    expect(
      getUntitledTemplateFileName({
        nodeTypeName: "???",
        sourceSpaceName: SOURCE_SPACE_NAME,
      }),
    ).toBe("Imported template (from my-graph)");
  });
});

type SchemaRow = { name: string; literal_content: Record<string, unknown> };

type SchemaQuery = {
  select: () => SchemaQuery;
  eq: () => SchemaQuery;
  maybeSingle: () => Promise<{ data: SchemaRow & { author_id: null } }>;
};

type FakeVault = {
  getAbstractFileByPath: (path: string) => TFile | TFolder | null;
  create: (path: string, content: string) => Promise<TFile>;
};

const createClient = (row: SchemaRow): DGSupabaseClient => {
  const query: SchemaQuery = {
    select: () => query,
    eq: () => query,
    maybeSingle: () => Promise.resolve({ data: { ...row, author_id: null } }),
  };
  return { from: () => query } as unknown as DGSupabaseClient;
};

/** Mirrors Obsidian, whose `vault.create` throws rather than overwrite an existing path. */
const createVault = (
  initialFiles: Record<string, string> = {},
): { files: Map<string, string>; vault: FakeVault } => {
  const files = new Map(Object.entries(initialFiles));
  const vault: FakeVault = {
    getAbstractFileByPath: (path) => {
      if (path === TEMPLATES_FOLDER) {
        return Object.assign(new TFolder(), { path });
      }
      return files.has(path) ? Object.assign(new TFile(), { path }) : null;
    },
    create: (path, content) => {
      if (files.has(path)) {
        return Promise.reject(new Error("File already exists."));
      }
      files.set(path, content);
      return Promise.resolve(Object.assign(new TFile(), { path }));
    },
  };
  return { files, vault };
};

const createPlugin = ({
  vault,
  templatesEnabled = true,
}: {
  vault: FakeVault;
  templatesEnabled?: boolean;
}): DiscourseGraphPlugin =>
  ({
    app: {
      vault,
      internalPlugins: {
        plugins: {
          templates: {
            enabled: templatesEnabled,
            instance: { options: { folder: TEMPLATES_FOLDER } },
          },
        },
      },
    } as unknown as App,
    settings: { nodeTypes: [] },
    saveSettings: () => Promise.resolve(),
  }) as unknown as DiscourseGraphPlugin;

const importNodeType = ({
  plugin,
  schema,
}: {
  plugin: DiscourseGraphPlugin;
  schema: SchemaRow;
}): Promise<string> =>
  mapNodeTypeIdToLocal({
    plugin,
    client: createClient(schema),
    sourceSpaceId: 1,
    sourceSpaceUri: "https://roamresearch.com/#/app/my-graph",
    sourceSpaceName: SOURCE_SPACE_NAME,
    sourceNodeTypeId: "remote-type",
  });

const UNTITLED_TEMPLATE_CONTENT = "* Question:\n";
const UNTITLED_SCHEMA: SchemaRow = {
  name: "Evidence",
  literal_content: {
    label: "Evidence",
    format: "[[EVD]] - {content}",
    template_content: UNTITLED_TEMPLATE_CONTENT,
  },
};
const UNTITLED_TEMPLATE_NAME = "Evidence (from my-graph)";
const UNTITLED_TEMPLATE_PATH = `${TEMPLATES_FOLDER}/${UNTITLED_TEMPLATE_NAME}.md`;

const TITLED_TEMPLATE_NAME = "Claim template";
const TITLED_TEMPLATE_CONTENT = "* Grounds:\n";
const TITLED_SCHEMA: SchemaRow = {
  name: "Claim",
  literal_content: {
    label: "Claim",
    template: TITLED_TEMPLATE_NAME,
    template_content: TITLED_TEMPLATE_CONTENT,
  },
};
const TITLED_TEMPLATE_PATH = `${TEMPLATES_FOLDER}/${TITLED_TEMPLATE_NAME}.md`;

describe("mapNodeTypeIdToLocal template import", () => {
  it("creates and assigns a template named after the node type when the template has no title", async () => {
    const { files, vault } = createVault();
    const plugin = createPlugin({ vault });

    await importNodeType({ plugin, schema: UNTITLED_SCHEMA });

    expect(files.get(UNTITLED_TEMPLATE_PATH)).toBe(UNTITLED_TEMPLATE_CONTENT);
    expect(plugin.settings.nodeTypes[0]?.template).toBe(UNTITLED_TEMPLATE_NAME);
  });

  it("leaves a local file with the node type's name untouched", async () => {
    const localFilePath = `${TEMPLATES_FOLDER}/Evidence.md`;
    const localContent = "My own template";
    const { files, vault } = createVault({ [localFilePath]: localContent });
    const plugin = createPlugin({ vault });

    await importNodeType({ plugin, schema: UNTITLED_SCHEMA });

    expect(files.get(localFilePath)).toBe(localContent);
    expect(files.get(UNTITLED_TEMPLATE_PATH)).toBe(UNTITLED_TEMPLATE_CONTENT);
    expect(plugin.settings.nodeTypes[0]?.template).toBe(UNTITLED_TEMPLATE_NAME);
  });

  it("creates no second template file on repeated imports, including after the node type was removed", async () => {
    const { files, vault } = createVault();
    const plugin = createPlugin({ vault });

    await importNodeType({ plugin, schema: UNTITLED_SCHEMA });
    await importNodeType({ plugin, schema: UNTITLED_SCHEMA });
    plugin.settings.nodeTypes = [];
    await importNodeType({ plugin, schema: UNTITLED_SCHEMA });

    expect([...files.keys()]).toEqual([UNTITLED_TEMPLATE_PATH]);
    expect(plugin.settings.nodeTypes).toMatchObject([
      { template: UNTITLED_TEMPLATE_NAME },
    ]);
  });

  it("names the template after its explicit title", async () => {
    const { files, vault } = createVault();
    const plugin = createPlugin({ vault });

    await importNodeType({ plugin, schema: TITLED_SCHEMA });

    expect(files.get(TITLED_TEMPLATE_PATH)).toBe(TITLED_TEMPLATE_CONTENT);
    expect(plugin.settings.nodeTypes[0]?.template).toBe(TITLED_TEMPLATE_NAME);
  });

  it("assigns a local file that already has the explicit title instead of overwriting it", async () => {
    const localContent = "Local claim template";
    const { files, vault } = createVault({
      [TITLED_TEMPLATE_PATH]: localContent,
    });
    const plugin = createPlugin({ vault });

    await importNodeType({ plugin, schema: TITLED_SCHEMA });

    expect(files.get(TITLED_TEMPLATE_PATH)).toBe(localContent);
    expect(plugin.settings.nodeTypes[0]?.template).toBe(TITLED_TEMPLATE_NAME);
  });

  it("imports the node type without a template when the Templates plugin is off", async () => {
    const { files, vault } = createVault();
    const plugin = createPlugin({ vault, templatesEnabled: false });

    await importNodeType({ plugin, schema: UNTITLED_SCHEMA });

    expect(files.size).toBe(0);
    expect(
      plugin.settings.nodeTypes.map((nodeType) => nodeType.template),
    ).toEqual([undefined]);
  });

  it("imports the node type without a template when the schema has no template content", async () => {
    const { files, vault } = createVault();
    const plugin = createPlugin({ vault });

    await importNodeType({
      plugin,
      schema: { name: "Claim", literal_content: { label: "Claim" } },
    });

    expect(files.size).toBe(0);
    expect(
      plugin.settings.nodeTypes.map((nodeType) => nodeType.template),
    ).toEqual([undefined]);
  });

  it("keeps an explicit title without content as the template reference and creates no file", async () => {
    const { files, vault } = createVault();
    const plugin = createPlugin({ vault });

    await importNodeType({
      plugin,
      schema: {
        name: "Claim",
        literal_content: { label: "Claim", template: TITLED_TEMPLATE_NAME },
      },
    });

    expect(files.size).toBe(0);
    expect(plugin.settings.nodeTypes[0]?.template).toBe(TITLED_TEMPLATE_NAME);
  });
});
