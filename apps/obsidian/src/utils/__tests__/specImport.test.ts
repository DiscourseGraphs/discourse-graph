import { describe, expect, it } from "vitest";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
  DiscourseSchemaFile,
  SchemaSelection,
} from "~/types";
import {
  applySchemaImportSelection,
  buildSchemaImportMatchPlan,
} from "~/utils/specImport";

const nodeType = (id: string, name: string): DiscourseNode =>
  ({ id, name, format: `[[${id}]] - {content}` }) as DiscourseNode;

const relationType = (id: string, label: string): DiscourseRelationType =>
  ({
    id,
    label,
    complement: `${label} by`,
    color: "red",
  }) as DiscourseRelationType;

const triple = ({
  id,
  sourceId,
  relationshipTypeId,
  destinationId,
}: Pick<
  DiscourseRelation,
  "id" | "sourceId" | "relationshipTypeId" | "destinationId"
>): DiscourseRelation =>
  ({ id, sourceId, relationshipTypeId, destinationId }) as DiscourseRelation;

const schemaFileOf = (
  parts: Partial<DiscourseSchemaFile>,
): DiscourseSchemaFile => ({
  version: 1,
  exportedAt: "2026-11-27T00:00:00.000Z",
  pluginVersion: "0.0.0",
  vaultName: "Source vault",
  vaultId: "source-vault-id",
  nodeTypes: [],
  relationTypes: [],
  discourseRelations: [],
  templates: [],
  ...parts,
});

type Settings = {
  nodeTypes: DiscourseNode[];
  relationTypes: DiscourseRelationType[];
  discourseRelations: DiscourseRelation[];
};

const runImport = async ({
  schemaFile,
  local = {},
  selection,
}: {
  schemaFile: DiscourseSchemaFile;
  local?: Partial<Settings>;
  selection: Partial<SchemaSelection>;
}): Promise<{ settings: Settings; warnings: string[] }> => {
  const settings: Settings = {
    nodeTypes: [],
    relationTypes: [],
    discourseRelations: [],
    ...local,
  };
  const plugin = {
    settings,
    saveSettings: () => Promise.resolve(),
  } as unknown as DiscourseGraphPlugin;
  const matchPlan = buildSchemaImportMatchPlan({
    schemaFile,
    localNodeTypes: settings.nodeTypes,
    localRelationTypes: settings.relationTypes,
    localDiscourseRelations: settings.discourseRelations,
    localTemplateNames: new Set(),
  });
  const warnings: string[] = [];
  await applySchemaImportSelection({
    plugin,
    loadedSchemaFile: { sourcePath: "schema.json", schemaFile, matchPlan },
    selection: {
      nodeTypeIds: [],
      relationTypeIds: [],
      discourseRelationIds: [],
      templateNames: [],
      ...selection,
    },
    onWarning: (message) => warnings.push(message),
  });
  return { settings, warnings };
};

const aliasedFile = schemaFileOf({
  nodeTypes: [nodeType("a", "Event"), nodeType("b", "event")],
  relationTypes: [relationType("r1", "Causes"), relationType("r2", "causes")],
  discourseRelations: [
    triple({
      id: "t1",
      sourceId: "b",
      relationshipTypeId: "r2",
      destinationId: "b",
    }),
  ],
});

describe("buildSchemaImportMatchPlan", () => {
  it("treats two file types differing only by case as two new types", () => {
    const plan = buildSchemaImportMatchPlan({
      schemaFile: aliasedFile,
      localNodeTypes: [],
      localRelationTypes: [],
      localDiscourseRelations: [],
      localTemplateNames: new Set(),
    });
    expect(plan.existingNodeTypeIds.size).toBe(0);
    expect(plan.existingRelationTypeIds.size).toBe(0);
    expect(plan.nodeTypeIdMapping.get("b")).toBe("b");
    expect(plan.relationTypeIdMapping.get("r2")).toBe("r2");
  });

  it("matches a file type to a vault type by case-insensitive name", () => {
    const plan = buildSchemaImportMatchPlan({
      schemaFile: aliasedFile,
      localNodeTypes: [nodeType("local", "EVENT")],
      localRelationTypes: [relationType("local-r", "CAUSES")],
      localDiscourseRelations: [],
      localTemplateNames: new Set(),
    });
    expect([...plan.existingNodeTypeIds]).toEqual(["a", "b"]);
    expect(plan.nodeTypeIdMapping.get("a")).toBe("local");
    expect(plan.nodeTypeIdMapping.get("b")).toBe("local");
    expect(plan.relationTypeIdMapping.get("r2")).toBe("local-r");
  });

  it("prefers the vault type with the exact casing", () => {
    const plan = buildSchemaImportMatchPlan({
      schemaFile: aliasedFile,
      localNodeTypes: [nodeType("x", "Event"), nodeType("y", "event")],
      localRelationTypes: [
        relationType("rx", "Causes"),
        relationType("ry", "causes"),
      ],
      localDiscourseRelations: [],
      localTemplateNames: new Set(),
    });
    expect(plan.nodeTypeIdMapping.get("a")).toBe("x");
    expect(plan.nodeTypeIdMapping.get("b")).toBe("y");
    expect(plan.relationTypeIdMapping.get("r1")).toBe("rx");
    expect(plan.relationTypeIdMapping.get("r2")).toBe("ry");
  });
});

describe("applySchemaImportSelection", () => {
  it("creates both case variants when both are selected, in either order", async () => {
    for (const nodeTypeIds of [
      ["a", "b"],
      ["b", "a"],
    ]) {
      const { settings, warnings } = await runImport({
        schemaFile: aliasedFile,
        selection: {
          nodeTypeIds,
          relationTypeIds: ["r1", "r2"],
          discourseRelationIds: ["t1"],
        },
      });
      expect(settings.nodeTypes.map((type) => type.name).sort()).toEqual([
        "Event",
        "event",
      ]);
      expect(settings.relationTypes.map((type) => type.label).sort()).toEqual([
        "Causes",
        "causes",
      ]);
      expect(settings.discourseRelations).toMatchObject([
        { sourceId: "b", relationshipTypeId: "r2", destinationId: "b" },
      ]);
      expect(warnings).toEqual([]);
    }
  });

  it("imports the second variant and its triple when the first is deselected", async () => {
    const { settings, warnings } = await runImport({
      schemaFile: aliasedFile,
      selection: {
        nodeTypeIds: ["b"],
        relationTypeIds: ["r2"],
        discourseRelationIds: ["t1"],
      },
    });
    expect(settings.nodeTypes.map((type) => type.id)).toEqual(["b"]);
    expect(settings.relationTypes.map((type) => type.id)).toEqual(["r2"]);
    expect(settings.discourseRelations).toHaveLength(1);
    expect(warnings).toEqual([]);
  });

  it("merges into a vault type that matches by name instead of creating", async () => {
    const { settings, warnings } = await runImport({
      schemaFile: aliasedFile,
      local: {
        nodeTypes: [nodeType("local", "EVENT")],
        relationTypes: [relationType("local-r", "CAUSES")],
      },
      selection: {
        nodeTypeIds: ["a", "b"],
        relationTypeIds: ["r1", "r2"],
        discourseRelationIds: ["t1"],
      },
    });
    expect(settings.nodeTypes.map((type) => type.id)).toEqual(["local"]);
    expect(settings.relationTypes.map((type) => type.id)).toEqual(["local-r"]);
    expect(settings.discourseRelations).toMatchObject([
      {
        sourceId: "local",
        relationshipTypeId: "local-r",
        destinationId: "local",
      },
    ]);
    expect(warnings).toEqual([]);
  });

  it("merges a repeated id in one file instead of creating a second type with that id", async () => {
    const { settings } = await runImport({
      schemaFile: schemaFileOf({
        nodeTypes: [nodeType("a", "Event"), nodeType("a", "Claim")],
        relationTypes: [
          relationType("r", "Causes"),
          relationType("r", "Leads to"),
        ],
      }),
      selection: { nodeTypeIds: ["a"], relationTypeIds: ["r"] },
    });
    expect(settings.nodeTypes.map((type) => type.id)).toEqual(["a"]);
    expect(settings.relationTypes.map((type) => type.id)).toEqual(["r"]);
  });

  it("merges two file entries with exactly the same name", async () => {
    const { settings } = await runImport({
      schemaFile: schemaFileOf({
        nodeTypes: [nodeType("a", "Event"), nodeType("b", "Event")],
        relationTypes: [
          relationType("r1", "Causes"),
          relationType("r2", "Causes"),
        ],
      }),
      selection: { nodeTypeIds: ["a", "b"], relationTypeIds: ["r1", "r2"] },
    });
    expect(settings.nodeTypes.map((type) => type.id)).toEqual(["a"]);
    expect(settings.relationTypes.map((type) => type.id)).toEqual(["r1"]);
  });
});
