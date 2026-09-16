import type DiscourseGraphPlugin from "~/index";
import { parseDgSchemaFile } from "~/utils/specValidation";
import { getTemplateFiles, readTemplateContent } from "~/utils/templates";
import { openJsonFromUserLocation } from "~/utils/nativeJsonFileDialogs";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
  DiscourseSchemaFile,
} from "~/types";
import {
  findExistingTriple,
  findLocalNodeTypeMatch,
  findLocalRelationTypeMatch,
  type SchemaImportMatchPlan,
} from "~/utils/schemaMatching";
import {
  buildSchemaConflicts,
  type SchemaConflict,
} from "~/utils/schemaFieldDiff";
export type { SchemaImportMatchPlan };
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
  conflicts: SchemaConflict[];
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
  const collapsedNodeTypeIds = new Set<string>();
  const localNodeTypeIds = new Set(
    localNodeTypes.map((nodeType) => nodeType.id),
  );
  // Grows as types are planned, so "Event" and "event" in one file collapse instead of creating two.
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
      // Matched a type planned earlier in this file, not one the vault holds.
      if (!localNodeTypeIds.has(localMatch.id)) {
        collapsedNodeTypeIds.add(nodeType.id);
      }
      continue;
    }

    nodeTypeIdMapping.set(nodeType.id, nodeType.id);
    knownNodeTypes.push(nodeType);
  }

  const relationTypeIdMapping = new Map<string, string>();
  const existingRelationTypeIds = new Set<string>();
  const collapsedRelationTypeIds = new Set<string>();
  const localRelationTypeIds = new Set(
    localRelationTypes.map((relationType) => relationType.id),
  );
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
      if (!localRelationTypeIds.has(localMatch.id)) {
        collapsedRelationTypeIds.add(relationType.id);
      }
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
    collapsedNodeTypeIds,
    collapsedRelationTypeIds,
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
    // A collapsed id is neither created nor held by the vault, so counting it as existing would name a type the user does not have.
    nodeTypes: {
      total: schemaFile.nodeTypes.length - matchPlan.collapsedNodeTypeIds.size,
      existing:
        matchPlan.existingNodeTypeIds.size -
        matchPlan.collapsedNodeTypeIds.size,
      new: schemaFile.nodeTypes.length - matchPlan.existingNodeTypeIds.size,
    },
    relationTypes: {
      total:
        schemaFile.relationTypes.length -
        matchPlan.collapsedRelationTypeIds.size,
      existing:
        matchPlan.existingRelationTypeIds.size -
        matchPlan.collapsedRelationTypeIds.size,
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

const readOverlappingTemplateContents = async ({
  plugin,
  matchPlan,
}: {
  plugin: DiscourseGraphPlugin;
  matchPlan: SchemaImportMatchPlan;
}): Promise<Map<string, string>> => {
  const entries = await Promise.all(
    [...matchPlan.existingTemplateNames].map(async (templateName) => {
      const content = await readTemplateContent({
        app: plugin.app,
        templateName,
      });
      return content === null ? [] : [[templateName, content] as const];
    }),
  );
  return new Map(entries.flat());
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

  const localTemplateContents = await readOverlappingTemplateContents({
    plugin,
    matchPlan,
  });

  return {
    loadedSchemaFile,
    previewStats: buildPreviewStats({ schemaFile, matchPlan }),
    conflicts: buildSchemaConflicts({
      schemaFile,
      matchPlan,
      localNodeTypes: plugin.settings.nodeTypes,
      localRelationTypes: plugin.settings.relationTypes,
      localTemplateContents,
    }),
  };
};
