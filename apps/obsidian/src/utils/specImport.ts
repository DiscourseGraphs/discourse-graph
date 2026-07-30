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
  SchemaSelection,
} from "~/types";
import { toTldrawColor } from "~/utils/tldrawColors";
import { canonicalObsidianUrl } from "~/utils/supabaseContext";
import {
  buildSchemaRid,
  findExistingTriple,
  findLocalNodeTypeMatch,
  findLocalRelationTypeMatch,
} from "~/utils/schemaMatching";

/**
 * Maps every id in the schema file to the local id it resolves to. The
 * `existing*` sets are schema-file ids that will NOT be created — either
 * because they already exist in the vault, or because they collapsed onto an
 * earlier item in the same file. Callers should resolve references through the
 * id mappings rather than assuming a schema id survives the import.
 */
export type SchemaImportMatchPlan = {
  nodeTypeIdMapping: Map<string, string>;
  relationTypeIdMapping: Map<string, string>;
  existingNodeTypeIds: Set<string>;
  existingRelationTypeIds: Set<string>;
  existingDiscourseRelationIds: Set<string>;
  existingTemplateNames: Set<string>;
  localTemplateNames: Set<string>;
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

export type SpecImportApplyResult = {
  created: {
    nodeTypes: number;
    relationTypes: number;
    discourseRelations: number;
    templates: number;
  };
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
  const nodeTypeIdMapping = new Map<string, string>();
  const existingNodeTypeIds = new Set<string>();
  // Grows as types are planned for creation, so a schema file holding both
  // "Event" and "event" collapses the second onto the first instead of creating
  // two types that matching would treat as one.
  const knownNodeTypes = [...localNodeTypes];

  for (const nodeType of schemaFile.nodeTypes) {
    const localMatch = findLocalNodeTypeMatch({
      localNodeTypes: knownNodeTypes,
      id: nodeType.id,
      name: nodeType.name,
    });
    if (localMatch) {
      nodeTypeIdMapping.set(nodeType.id, localMatch.id);
      existingNodeTypeIds.add(nodeType.id);
      continue;
    }

    nodeTypeIdMapping.set(nodeType.id, nodeType.id);
    knownNodeTypes.push(nodeType);
  }

  const relationTypeIdMapping = new Map<string, string>();
  const existingRelationTypeIds = new Set<string>();
  const knownRelationTypes = [...localRelationTypes];

  for (const relationType of schemaFile.relationTypes) {
    const localMatch = findLocalRelationTypeMatch({
      localRelationTypes: knownRelationTypes,
      id: relationType.id,
      label: relationType.label,
    });
    if (localMatch) {
      relationTypeIdMapping.set(relationType.id, localMatch.id);
      existingRelationTypeIds.add(relationType.id);
      continue;
    }

    relationTypeIdMapping.set(relationType.id, relationType.id);
    knownRelationTypes.push(relationType);
  }

  const existingDiscourseRelationIds = new Set<string>();
  for (const relation of schemaFile.discourseRelations) {
    const existing = findExistingTriple({
      discourseRelations: localDiscourseRelations,
      sourceId: nodeTypeIdMapping.get(relation.sourceId) ?? relation.sourceId,
      destinationId:
        nodeTypeIdMapping.get(relation.destinationId) ?? relation.destinationId,
      relationshipTypeId:
        relationTypeIdMapping.get(relation.relationshipTypeId) ??
        relation.relationshipTypeId,
    });
    if (existing) {
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
    localTemplateNames,
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
  onWarning = () => {},
}: {
  plugin: DiscourseGraphPlugin;
  loadedSchemaFile: LoadedSchemaFile;
  selection: SchemaSelection;
  onWarning?: (message: string) => void;
}): Promise<SpecImportApplyResult> => {
  const { schemaFile, matchPlan } = loadedSchemaFile;
  const sourceSpaceUri = canonicalObsidianUrl(schemaFile.vaultId);
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
      onWarning(
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
      onWarning(`Template "${template.name}" skipped: ${result.reason}.`);
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
      onWarning(
        `Node type "${nodeTypeId}" was selected but missing from schema file.`,
      );
      continue;
    }

    const newNodeType: DiscourseNode = {
      ...importedNodeType,
      template:
        importedNodeType.template &&
        (selectedTemplateNames.has(importedNodeType.template) ||
          matchPlan.localTemplateNames.has(importedNodeType.template))
          ? importedNodeType.template
          : undefined,
      importedFromRid: buildSchemaRid({
        spaceUri: sourceSpaceUri,
        localId: importedNodeType.id,
      }),
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
      onWarning(
        `Relation type "${relationTypeId}" was selected but missing from schema file.`,
      );
      continue;
    }

    const newRelationType: DiscourseRelationType = {
      ...importedRelationType,
      color: toTldrawColor(importedRelationType.color),
      importedFromRid: buildSchemaRid({
        spaceUri: sourceSpaceUri,
        localId: importedRelationType.id,
      }),
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

    const mappedSourceId =
      matchPlan.nodeTypeIdMapping.get(relation.sourceId) ?? relation.sourceId;
    const mappedDestinationId =
      matchPlan.nodeTypeIdMapping.get(relation.destinationId) ??
      relation.destinationId;
    const mappedRelationTypeId =
      matchPlan.relationTypeIdMapping.get(relation.relationshipTypeId) ??
      relation.relationshipTypeId;

    // Checked against live settings, not the plan: distinct schema node types can
    // collapse onto one local type, so two file relations can map to one triple.
    const alreadyPresent = findExistingTriple({
      discourseRelations: plugin.settings.discourseRelations,
      sourceId: mappedSourceId,
      destinationId: mappedDestinationId,
      relationshipTypeId: mappedRelationTypeId,
    });
    if (alreadyPresent) {
      continue;
    }

    const newRelation: DiscourseRelation = {
      ...relation,
      id: uuidv7(),
      sourceId: mappedSourceId,
      destinationId: mappedDestinationId,
      relationshipTypeId: mappedRelationTypeId,
      importedFromRid: buildSchemaRid({
        spaceUri: sourceSpaceUri,
        localId: relation.id,
      }),
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
  };
};
