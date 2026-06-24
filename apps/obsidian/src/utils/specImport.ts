import type DiscourseGraphPlugin from "~/index";
import { uuidv7 } from "uuidv7";
import { parseDgSchemaFile, type DgSchemaFile } from "~/utils/specValidation";
import { createTemplateFile, getTemplateFiles } from "~/utils/templates";
import {
  NativeFileDialogCancelledError,
  openJsonFromUserLocation,
} from "~/utils/nativeJsonFileDialogs";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";
import { toTldrawColor } from "~/utils/tldrawColors";

export type SpecImportPreview = {
  loadedSchemaFile: LoadedSchemaFile;
  previewStats: ImportPreviewStats;
};

export type LoadedSchemaFile = {
  sourcePath: string;
  schemaFile: DgSchemaFile;
};

export type ImportPreviewStats = {
  nodeTypes: {
    total: number;
    matchedById: number;
    matchedByName: number;
    newCount: number;
  };
  relationTypes: {
    total: number;
    matchedById: number;
    matchedByLabel: number;
    newCount: number;
  };
  discourseRelations: {
    total: number;
    existingCount: number;
    newCount: number;
  };
  templates: {
    total: number;
    existingCount: number;
    newCount: number;
  };
};

export type SpecImportSelection = {
  nodeTypeIds: string[];
  relationTypeIds: string[];
  discourseRelationIds: string[];
  templateNames: string[];
};

export type SpecImportApplyResult = {
  templates: {
    created: number;
    existing: number;
    skipped: number;
  };
  nodeTypes: {
    created: number;
    matchedById: number;
    matchedByName: number;
    templateAttachedToExisting: number;
  };
  relationTypes: {
    created: number;
    matchedById: number;
    matchedByLabel: number;
  };
  discourseRelations: {
    created: number;
    existing: number;
  };
  warnings: string[];
};

const parseSchemaFileContent = (content: string): DgSchemaFile => {
  const parsed = JSON.parse(content) as unknown;
  return parseDgSchemaFile(parsed);
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

export const pickAndPreviewSchemaImport = async ({
  plugin,
}: {
  plugin: DiscourseGraphPlugin;
}): Promise<SpecImportPreview> => {
  const file = await openJsonFromUserLocation({
    title: "Import discourse graph schema",
  });
  const schemaFile = parseSchemaFileContent(file.content);

  const localNodeTypeById = new Map(
    plugin.settings.nodeTypes.map((nodeType) => [nodeType.id, nodeType]),
  );
  const localNodeTypeByName = new Map(
    plugin.settings.nodeTypes.map((nodeType) => [
      normalizeLabel(nodeType.name),
      nodeType,
    ]),
  );

  const localRelationTypeById = new Map(
    plugin.settings.relationTypes.map((relationType) => [
      relationType.id,
      relationType,
    ]),
  );
  const localRelationTypeByLabel = new Map(
    plugin.settings.relationTypes.map((relationType) => [
      normalizeLabel(relationType.label),
      relationType,
    ]),
  );

  let nodeMatchedById = 0;
  let nodeMatchedByName = 0;
  const nodeTypeIdMapping = new Map<string, string>();
  for (const nodeType of schemaFile.nodeTypes) {
    const matchById = localNodeTypeById.get(nodeType.id);
    if (matchById) {
      nodeMatchedById += 1;
      nodeTypeIdMapping.set(nodeType.id, matchById.id);
      continue;
    }

    const matchByName = localNodeTypeByName.get(normalizeLabel(nodeType.name));
    if (matchByName) {
      nodeMatchedByName += 1;
      nodeTypeIdMapping.set(nodeType.id, matchByName.id);
      continue;
    }

    nodeTypeIdMapping.set(nodeType.id, nodeType.id);
  }

  let relationTypeMatchedById = 0;
  let relationTypeMatchedByLabel = 0;
  const relationTypeIdMapping = new Map<string, string>();
  for (const relationType of schemaFile.relationTypes) {
    const matchById = localRelationTypeById.get(relationType.id);
    if (matchById) {
      relationTypeMatchedById += 1;
      relationTypeIdMapping.set(relationType.id, matchById.id);
      continue;
    }

    const matchByLabel = localRelationTypeByLabel.get(
      normalizeLabel(relationType.label),
    );
    if (matchByLabel) {
      relationTypeMatchedByLabel += 1;
      relationTypeIdMapping.set(relationType.id, matchByLabel.id);
      continue;
    }

    relationTypeIdMapping.set(relationType.id, relationType.id);
  }

  const localTripleKeys = new Set(
    plugin.settings.discourseRelations.map((relation) =>
      buildTripleKey({
        sourceId: relation.sourceId,
        relationshipTypeId: relation.relationshipTypeId,
        destinationId: relation.destinationId,
      }),
    ),
  );

  let existingRelationCount = 0;
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
      existingRelationCount += 1;
    }
  }

  const localTemplateNames = new Set(getTemplateFiles(plugin.app));
  let existingTemplateCount = 0;
  for (const template of schemaFile.templates) {
    if (localTemplateNames.has(template.name)) {
      existingTemplateCount += 1;
    }
  }

  const loadedSchemaFile: LoadedSchemaFile = {
    sourcePath: file.sourcePath,
    schemaFile,
  };

  const previewStats: ImportPreviewStats = {
    nodeTypes: {
      total: schemaFile.nodeTypes.length,
      matchedById: nodeMatchedById,
      matchedByName: nodeMatchedByName,
      newCount:
        schemaFile.nodeTypes.length - nodeMatchedById - nodeMatchedByName,
    },
    relationTypes: {
      total: schemaFile.relationTypes.length,
      matchedById: relationTypeMatchedById,
      matchedByLabel: relationTypeMatchedByLabel,
      newCount:
        schemaFile.relationTypes.length -
        relationTypeMatchedById -
        relationTypeMatchedByLabel,
    },
    discourseRelations: {
      total: schemaFile.discourseRelations.length,
      existingCount: existingRelationCount,
      newCount: schemaFile.discourseRelations.length - existingRelationCount,
    },
    templates: {
      total: schemaFile.templates.length,
      existingCount: existingTemplateCount,
      newCount: schemaFile.templates.length - existingTemplateCount,
    },
  };

  return {
    loadedSchemaFile,
    previewStats,
  };
};

const applyTemplateFiles = async ({
  plugin,
  schemaFile,
  selectedTemplateNames,
}: {
  plugin: DiscourseGraphPlugin;
  schemaFile: DgSchemaFile;
  selectedTemplateNames: Set<string>;
}): Promise<{
  availability: Map<string, boolean>;
  created: number;
  existing: number;
  skipped: number;
  warnings: string[];
}> => {
  const warnings: string[] = [];
  const availability = new Map<string, boolean>();
  let created = 0;
  let existing = 0;
  let skipped = 0;

  const templatesByName = new Map(
    schemaFile.templates.map((template) => [template.name, template]),
  );
  for (const templateName of selectedTemplateNames) {
    const template = templatesByName.get(templateName);
    if (!template) {
      skipped += 1;
      warnings.push(
        `Template "${templateName}" was selected but not found in schema file.`,
      );
      availability.set(templateName, false);
      continue;
    }

    const result = await createTemplateFile({
      app: plugin.app,
      templateName: template.name,
      content: template.content,
    });

    if (result.created) {
      created += 1;
      availability.set(template.name, true);
      continue;
    }

    if (result.reason === "template already exists") {
      existing += 1;
      availability.set(template.name, true);
      continue;
    }

    skipped += 1;
    availability.set(template.name, false);
    warnings.push(`Template "${template.name}" skipped: ${result.reason}.`);
  }

  return { availability, created, existing, skipped, warnings };
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
  const schemaFile = loadedSchemaFile.schemaFile;

  const selectedRelationIds = new Set(selection.discourseRelationIds);
  const selectedNodeTypeIds = new Set(selection.nodeTypeIds);
  const selectedRelationTypeIds = new Set(selection.relationTypeIds);
  const selectedTemplateNames = new Set(selection.templateNames);

  for (const relation of schemaFile.discourseRelations) {
    if (!selectedRelationIds.has(relation.id)) continue;
    selectedNodeTypeIds.add(relation.sourceId);
    selectedNodeTypeIds.add(relation.destinationId);
    selectedRelationTypeIds.add(relation.relationshipTypeId);
  }

  const templatesResult = await applyTemplateFiles({
    plugin,
    schemaFile,
    selectedTemplateNames,
  });
  warnings.push(...templatesResult.warnings);

  const schemaNodeTypesById = new Map(
    schemaFile.nodeTypes.map((nodeType) => [nodeType.id, nodeType]),
  );
  const schemaRelationTypesById = new Map(
    schemaFile.relationTypes.map((relationType) => [
      relationType.id,
      relationType,
    ]),
  );

  const nodeTypeIdMapping = new Map<string, string>();
  let nodeTypesCreated = 0;
  let nodeTypesMatchedById = 0;
  let nodeTypesMatchedByName = 0;
  let templateAttachedToExisting = 0;

  for (const nodeTypeId of selectedNodeTypeIds) {
    const importedNodeType = schemaNodeTypesById.get(nodeTypeId);
    if (!importedNodeType) {
      warnings.push(
        `Node type "${nodeTypeId}" was selected but missing from schema file.`,
      );
      continue;
    }

    const matchById = plugin.settings.nodeTypes.find(
      (nodeType) => nodeType.id === nodeTypeId,
    );
    if (matchById) {
      nodeTypesMatchedById += 1;
      nodeTypeIdMapping.set(nodeTypeId, matchById.id);
      if (
        importedNodeType.description &&
        (!matchById.description || !matchById.description.trim())
      ) {
        matchById.description = importedNodeType.description;
        matchById.modified = Date.now();
      }
      if (
        importedNodeType.template &&
        selectedTemplateNames.has(importedNodeType.template) &&
        templatesResult.availability.get(importedNodeType.template) &&
        !matchById.template
      ) {
        matchById.template = importedNodeType.template;
        matchById.modified = Date.now();
        templateAttachedToExisting += 1;
      }
      continue;
    }

    const matchByName = plugin.settings.nodeTypes.find(
      (nodeType) =>
        normalizeLabel(nodeType.name) === normalizeLabel(importedNodeType.name),
    );
    if (matchByName) {
      nodeTypesMatchedByName += 1;
      nodeTypeIdMapping.set(nodeTypeId, matchByName.id);
      if (
        importedNodeType.description &&
        (!matchByName.description || !matchByName.description.trim())
      ) {
        matchByName.description = importedNodeType.description;
        matchByName.modified = Date.now();
      }
      if (
        importedNodeType.template &&
        selectedTemplateNames.has(importedNodeType.template) &&
        templatesResult.availability.get(importedNodeType.template) &&
        !matchByName.template
      ) {
        matchByName.template = importedNodeType.template;
        matchByName.modified = Date.now();
        templateAttachedToExisting += 1;
      }
      continue;
    }

    const newNodeType: DiscourseNode = {
      ...importedNodeType,
      template:
        importedNodeType.template &&
        selectedTemplateNames.has(importedNodeType.template) &&
        templatesResult.availability.get(importedNodeType.template)
          ? importedNodeType.template
          : undefined,
      modified: Date.now(),
    };
    plugin.settings.nodeTypes = [...plugin.settings.nodeTypes, newNodeType];
    nodeTypesCreated += 1;
    nodeTypeIdMapping.set(nodeTypeId, newNodeType.id);
  }

  const relationTypeIdMapping = new Map<string, string>();
  let relationTypesCreated = 0;
  let relationTypesMatchedById = 0;
  let relationTypesMatchedByLabel = 0;

  for (const relationTypeId of selectedRelationTypeIds) {
    const importedRelationType = schemaRelationTypesById.get(relationTypeId);
    if (!importedRelationType) {
      warnings.push(
        `Relation type "${relationTypeId}" was selected but missing from schema file.`,
      );
      continue;
    }

    const matchById = plugin.settings.relationTypes.find(
      (relationType) => relationType.id === relationTypeId,
    );
    if (matchById) {
      relationTypesMatchedById += 1;
      relationTypeIdMapping.set(relationTypeId, matchById.id);
      continue;
    }

    const matchByLabel = plugin.settings.relationTypes.find(
      (relationType) =>
        normalizeLabel(relationType.label) ===
        normalizeLabel(importedRelationType.label),
    );
    if (matchByLabel) {
      relationTypesMatchedByLabel += 1;
      relationTypeIdMapping.set(relationTypeId, matchByLabel.id);
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
    relationTypeIdMapping.set(relationTypeId, newRelationType.id);
  }

  let discourseRelationsCreated = 0;
  let discourseRelationsExisting = 0;
  for (const relation of schemaFile.discourseRelations) {
    if (!selectedRelationIds.has(relation.id)) {
      continue;
    }

    const mappedSourceId =
      nodeTypeIdMapping.get(relation.sourceId) ?? relation.sourceId;
    const mappedDestinationId =
      nodeTypeIdMapping.get(relation.destinationId) ?? relation.destinationId;
    const mappedRelationTypeId =
      relationTypeIdMapping.get(relation.relationshipTypeId) ??
      relation.relationshipTypeId;

    const exists = plugin.settings.discourseRelations.some(
      (localRelation) =>
        localRelation.sourceId === mappedSourceId &&
        localRelation.destinationId === mappedDestinationId &&
        localRelation.relationshipTypeId === mappedRelationTypeId,
    );
    if (exists) {
      discourseRelationsExisting += 1;
      continue;
    }

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
    templates: {
      created: templatesResult.created,
      existing: templatesResult.existing,
      skipped: templatesResult.skipped,
    },
    nodeTypes: {
      created: nodeTypesCreated,
      matchedById: nodeTypesMatchedById,
      matchedByName: nodeTypesMatchedByName,
      templateAttachedToExisting,
    },
    relationTypes: {
      created: relationTypesCreated,
      matchedById: relationTypesMatchedById,
      matchedByLabel: relationTypesMatchedByLabel,
    },
    discourseRelations: {
      created: discourseRelationsCreated,
      existing: discourseRelationsExisting,
    },
    warnings,
  };
};

export { NativeFileDialogCancelledError as ImportFileSelectionCancelledError };
