import type DiscourseGraphPlugin from "~/index";
import { uuidv7 } from "uuidv7";
import { parseDgSchemaFile } from "~/utils/specValidation";
import { createTemplateFile, getTemplateFiles } from "~/utils/templates";
import { openJsonFromUserLocation } from "~/utils/nativeJsonFileDialogs";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
  DiscourseSchemaFile,
} from "~/types";
import { toTldrawColor } from "~/utils/tldrawColors";

export type SchemaImportMatchPlan = {
  nodeTypeIdMapping: Map<string, string>;
  relationTypeIdMapping: Map<string, string>;
  existingNodeTypeIds: Set<string>;
  existingRelationTypeIds: Set<string>;
  existingDiscourseRelationIds: Set<string>;
  existingTemplateNames: Set<string>;
};

export type LoadedSchemaFile = {
  sourcePath: string;
  schemaFile: DiscourseSchemaFile;
  matchPlan: SchemaImportMatchPlan;
};

export type ImportPreviewStats = {
  nodeTypes: { total: number; new: number; existing: number };
  relationTypes: { total: number; new: number; existing: number };
  discourseRelations: { total: number; new: number; existing: number };
  templates: { total: number; new: number; existing: number };
};

export type SpecImportPreview = {
  loadedSchemaFile: LoadedSchemaFile;
  previewStats: ImportPreviewStats;
};

export type SpecImportSelection = {
  nodeTypeIds: string[];
  relationTypeIds: string[];
  discourseRelationIds: string[];
  templateNames: string[];
};

export type SpecImportApplyResult = {
  created: {
    nodeTypes: number;
    relationTypes: number;
    discourseRelations: number;
    templates: number;
  };
  warnings: string[];
};

const normalizeLabel = (value: string): string => {
  return value.trim().toLowerCase();
};

const buildTripleKey = ({
  sourceId,
  relationshipTypeId,
  destinationId,
}: {
  sourceId: string;
  relationshipTypeId: string;
  destinationId: string;
}): string => {
  return `${sourceId}::${relationshipTypeId}::${destinationId}`;
};

const buildSchemaImportMatchPlan = ({
  schemaFile,
  localNodeTypes,
  localRelationTypes,
  localDiscourseRelations,
  localTemplateNames,
}: {
  schemaFile: DiscourseSchemaFile;
  localNodeTypes: DiscourseNode[];
  localRelationTypes: DiscourseRelationType[];
  localDiscourseRelations: DiscourseRelation[];
  localTemplateNames: Set<string>;
}): SchemaImportMatchPlan => {
  const localNodeTypeById = new Map(
    localNodeTypes.map((nodeType) => [nodeType.id, nodeType]),
  );
  const localNodeTypeByName = new Map(
    localNodeTypes.map((nodeType) => [normalizeLabel(nodeType.name), nodeType]),
  );
  const localRelationTypeById = new Map(
    localRelationTypes.map((relationType) => [relationType.id, relationType]),
  );
  const localRelationTypeByLabel = new Map(
    localRelationTypes.map((relationType) => [
      normalizeLabel(relationType.label),
      relationType,
    ]),
  );

  const nodeTypeIdMapping = new Map<string, string>();
  const existingNodeTypeIds = new Set<string>();

  for (const nodeType of schemaFile.nodeTypes) {
    const matchById = localNodeTypeById.get(nodeType.id);
    if (matchById) {
      nodeTypeIdMapping.set(nodeType.id, matchById.id);
      existingNodeTypeIds.add(nodeType.id);
      continue;
    }

    const matchByName = localNodeTypeByName.get(normalizeLabel(nodeType.name));
    if (matchByName) {
      nodeTypeIdMapping.set(nodeType.id, matchByName.id);
      existingNodeTypeIds.add(nodeType.id);
      continue;
    }

    nodeTypeIdMapping.set(nodeType.id, nodeType.id);
  }

  const relationTypeIdMapping = new Map<string, string>();
  const existingRelationTypeIds = new Set<string>();

  for (const relationType of schemaFile.relationTypes) {
    const matchById = localRelationTypeById.get(relationType.id);
    if (matchById) {
      relationTypeIdMapping.set(relationType.id, matchById.id);
      existingRelationTypeIds.add(relationType.id);
      continue;
    }

    const matchByLabel = localRelationTypeByLabel.get(
      normalizeLabel(relationType.label),
    );
    if (matchByLabel) {
      relationTypeIdMapping.set(relationType.id, matchByLabel.id);
      existingRelationTypeIds.add(relationType.id);
      continue;
    }

    relationTypeIdMapping.set(relationType.id, relationType.id);
  }

  const localTripleKeys = new Set(
    localDiscourseRelations.map((relation) =>
      buildTripleKey({
        sourceId: relation.sourceId,
        relationshipTypeId: relation.relationshipTypeId,
        destinationId: relation.destinationId,
      }),
    ),
  );

  const existingDiscourseRelationIds = new Set<string>();
  for (const relation of schemaFile.discourseRelations) {
    const mappedSourceId =
      nodeTypeIdMapping.get(relation.sourceId) ?? relation.sourceId;
    const mappedDestinationId =
      nodeTypeIdMapping.get(relation.destinationId) ?? relation.destinationId;
    const mappedRelationTypeId =
      relationTypeIdMapping.get(relation.relationshipTypeId) ??
      relation.relationshipTypeId;
    const key = buildTripleKey({
      sourceId: mappedSourceId,
      relationshipTypeId: mappedRelationTypeId,
      destinationId: mappedDestinationId,
    });
    if (localTripleKeys.has(key)) {
      existingDiscourseRelationIds.add(relation.id);
    }
  }

  const existingTemplateNames = new Set<string>();
  for (const template of schemaFile.templates) {
    if (localTemplateNames.has(template.name)) {
      existingTemplateNames.add(template.name);
    }
  }

  return {
    nodeTypeIdMapping,
    relationTypeIdMapping,
    existingNodeTypeIds,
    existingRelationTypeIds,
    existingDiscourseRelationIds,
    existingTemplateNames,
  };
};

const buildPreviewStats = ({
  schemaFile,
  matchPlan,
}: {
  schemaFile: DiscourseSchemaFile;
  matchPlan: SchemaImportMatchPlan;
}): ImportPreviewStats => {
  return {
    nodeTypes: {
      total: schemaFile.nodeTypes.length,
      existing: matchPlan.existingNodeTypeIds.size,
      new: schemaFile.nodeTypes.length - matchPlan.existingNodeTypeIds.size,
    },
    relationTypes: {
      total: schemaFile.relationTypes.length,
      existing: matchPlan.existingRelationTypeIds.size,
      new:
        schemaFile.relationTypes.length -
        matchPlan.existingRelationTypeIds.size,
    },
    discourseRelations: {
      total: schemaFile.discourseRelations.length,
      existing: matchPlan.existingDiscourseRelationIds.size,
      new:
        schemaFile.discourseRelations.length -
        matchPlan.existingDiscourseRelationIds.size,
    },
    templates: {
      total: schemaFile.templates.length,
      existing: matchPlan.existingTemplateNames.size,
      new: schemaFile.templates.length - matchPlan.existingTemplateNames.size,
    },
  };
};

export const pickAndPreviewSchemaImport = async ({
  plugin,
}: {
  plugin: DiscourseGraphPlugin;
}): Promise<SpecImportPreview> => {
  const file = await openJsonFromUserLocation({
    title: "Import discourse graph schema",
  });
  const schemaFile = parseDgSchemaFile(JSON.parse(file.content) as unknown);
  const localTemplateNames = new Set(getTemplateFiles(plugin.app));
  const matchPlan = buildSchemaImportMatchPlan({
    schemaFile,
    localNodeTypes: plugin.settings.nodeTypes,
    localRelationTypes: plugin.settings.relationTypes,
    localDiscourseRelations: plugin.settings.discourseRelations,
    localTemplateNames,
  });

  const loadedSchemaFile: LoadedSchemaFile = {
    sourcePath: file.sourcePath,
    schemaFile,
    matchPlan,
  };

  return {
    loadedSchemaFile,
    previewStats: buildPreviewStats({ schemaFile, matchPlan }),
  };
};

export const applySchemaImportSelection = async ({
  plugin,
  loadedSchemaFile,
  selection,
}: {
  plugin: DiscourseGraphPlugin;
  loadedSchemaFile: LoadedSchemaFile;
  selection: SpecImportSelection;
}): Promise<SpecImportApplyResult> => {
  const warnings: string[] = [];
  const { schemaFile, matchPlan } = loadedSchemaFile;
  const selectedTemplateNames = new Set(selection.templateNames);
  const selectedNodeTypeIds = new Set(selection.nodeTypeIds);
  const selectedRelationTypeIds = new Set(selection.relationTypeIds);
  const selectedRelationIds = new Set(selection.discourseRelationIds);

  let templatesCreated = 0;
  const templatesByName = new Map(
    schemaFile.templates.map((template) => [template.name, template]),
  );
  for (const templateName of selectedTemplateNames) {
    if (matchPlan.existingTemplateNames.has(templateName)) {
      continue;
    }

    const template = templatesByName.get(templateName);
    if (!template) {
      warnings.push(
        `Template "${templateName}" was selected but not found in schema file.`,
      );
      continue;
    }

    const result = await createTemplateFile({
      app: plugin.app,
      templateName: template.name,
      content: template.content,
    });

    if (result.created) {
      templatesCreated += 1;
      continue;
    }

    if (result.reason !== "template already exists") {
      warnings.push(`Template "${template.name}" skipped: ${result.reason}.`);
    }
  }

  const schemaNodeTypesById = new Map(
    schemaFile.nodeTypes.map((nodeType) => [nodeType.id, nodeType]),
  );
  const schemaRelationTypesById = new Map(
    schemaFile.relationTypes.map((relationType) => [
      relationType.id,
      relationType,
    ]),
  );

  let nodeTypesCreated = 0;
  for (const nodeTypeId of selectedNodeTypeIds) {
    if (matchPlan.existingNodeTypeIds.has(nodeTypeId)) {
      continue;
    }

    const importedNodeType = schemaNodeTypesById.get(nodeTypeId);
    if (!importedNodeType) {
      warnings.push(
        `Node type "${nodeTypeId}" was selected but missing from schema file.`,
      );
      continue;
    }

    const newNodeType: DiscourseNode = {
      ...importedNodeType,
      template:
        importedNodeType.template &&
        selectedTemplateNames.has(importedNodeType.template)
          ? importedNodeType.template
          : undefined,
      modified: Date.now(),
    };
    plugin.settings.nodeTypes = [...plugin.settings.nodeTypes, newNodeType];
    nodeTypesCreated += 1;
  }

  let relationTypesCreated = 0;
  for (const relationTypeId of selectedRelationTypeIds) {
    if (matchPlan.existingRelationTypeIds.has(relationTypeId)) {
      continue;
    }

    const importedRelationType = schemaRelationTypesById.get(relationTypeId);
    if (!importedRelationType) {
      warnings.push(
        `Relation type "${relationTypeId}" was selected but missing from schema file.`,
      );
      continue;
    }

    const newRelationType: DiscourseRelationType = {
      ...importedRelationType,
      color: toTldrawColor(importedRelationType.color),
      status: "provisional",
      modified: Date.now(),
    };
    plugin.settings.relationTypes = [
      ...plugin.settings.relationTypes,
      newRelationType,
    ];
    relationTypesCreated += 1;
  }

  let discourseRelationsCreated = 0;
  for (const relation of schemaFile.discourseRelations) {
    if (!selectedRelationIds.has(relation.id)) {
      continue;
    }
    if (matchPlan.existingDiscourseRelationIds.has(relation.id)) {
      continue;
    }

    const mappedSourceId =
      matchPlan.nodeTypeIdMapping.get(relation.sourceId) ?? relation.sourceId;
    const mappedDestinationId =
      matchPlan.nodeTypeIdMapping.get(relation.destinationId) ??
      relation.destinationId;
    const mappedRelationTypeId =
      matchPlan.relationTypeIdMapping.get(relation.relationshipTypeId) ??
      relation.relationshipTypeId;

    const newRelation: DiscourseRelation = {
      ...relation,
      id: uuidv7(),
      sourceId: mappedSourceId,
      destinationId: mappedDestinationId,
      relationshipTypeId: mappedRelationTypeId,
      status: "provisional",
      modified: Date.now(),
    };
    plugin.settings.discourseRelations = [
      ...plugin.settings.discourseRelations,
      newRelation,
    ];
    discourseRelationsCreated += 1;
  }

  await plugin.saveSettings();

  return {
    created: {
      nodeTypes: nodeTypesCreated,
      relationTypes: relationTypesCreated,
      discourseRelations: discourseRelationsCreated,
      templates: templatesCreated,
    },
    warnings,
  };
};
