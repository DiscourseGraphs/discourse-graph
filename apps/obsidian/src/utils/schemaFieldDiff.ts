import type {
  DiscourseNode,
  DiscourseRelationType,
  DiscourseSchemaFile,
} from "~/types";
import type { SchemaImportMatchPlan } from "~/utils/schemaMatching";

/**
 * Fields a schema import may overwrite on an item that already exists locally.
 *
 * `name` and `label` are deliberately absent. Matching is id-first, so an id
 * match carrying a different name reads as a rename — but renaming a type does
 * not retag the pages already tagged with it, so the vault would silently split
 * into old-name and new-name halves. `id`, `created`, `authorId` and
 * `importedFromRid` are identity and provenance rather than editable content.
 *
 * The `satisfies` clause pins each list to its type: dropping or renaming a
 * field on DiscourseNode fails to compile here until the list is updated.
 */
export const MERGEABLE_NODE_TYPE_FIELDS = [
  "format",
  "template",
  "description",
  "shortcut",
  "color",
  "tag",
  "keyImage",
  "folderPath",
] as const satisfies readonly (keyof DiscourseNode)[];

export const MERGEABLE_RELATION_TYPE_FIELDS = [
  "complement",
  "color",
] as const satisfies readonly (keyof DiscourseRelationType)[];

/** Templates are all-or-nothing: the whole file body is replaced or kept. */
export const TEMPLATE_CONTENT_FIELD = "content";

export type SchemaFieldChange = {
  field: string;
  localValue: string | boolean | undefined;
  importedValue: string | boolean | undefined;
};

export type SchemaConflictCategory = "nodeType" | "relationType" | "template";

/**
 * One locally-present item that the imported file also describes, plus the
 * fields whose values disagree. Keyed by schema-file id, not local id: the match
 * plan deliberately collapses schema types that collide by normalized name, so
 * two schema ids can share one local id and a local-keyed structure would drop
 * one of them.
 */
export type SchemaConflict = {
  category: SchemaConflictCategory;
  schemaId: string;
  label: string;
  changes: SchemaFieldChange[];
};

/**
 * A field the file has no value for is not an instruction to clear the local
 * one. An export from an older plugin simply lacks fields it never knew about,
 * and offering those as "changes" would turn version skew into silent deletion.
 * Merge only ever adds or overwrites.
 *
 * An empty string counts as "no value" alongside undefined: settings persist a
 * cleared optional field as "" but omit one that was never set, so the two
 * spellings of empty must not read as a difference. Without this, a node type
 * identical to the local one is offered for merge with both sides rendering as
 * "empty".
 */
const hasNoImportedValue = (
  value: SchemaFieldChange["importedValue"],
): boolean => value === undefined || value === "";

const buildNodeTypeFieldChanges = ({
  local,
  imported,
}: {
  local: DiscourseNode;
  imported: DiscourseNode;
}): SchemaFieldChange[] => {
  return MERGEABLE_NODE_TYPE_FIELDS.flatMap((field) => {
    const localValue = local[field];
    const importedValue = imported[field];
    if (hasNoImportedValue(importedValue)) return [];
    if (localValue === importedValue) return [];
    return [{ field, localValue, importedValue }];
  });
};

const buildRelationTypeFieldChanges = ({
  local,
  imported,
}: {
  local: DiscourseRelationType;
  imported: DiscourseRelationType;
}): SchemaFieldChange[] => {
  return MERGEABLE_RELATION_TYPE_FIELDS.flatMap((field) => {
    const localValue = local[field];
    const importedValue = imported[field];
    if (hasNoImportedValue(importedValue)) return [];
    if (localValue === importedValue) return [];
    return [{ field, localValue, importedValue }];
  });
};

export const buildSchemaConflicts = ({
  schemaFile,
  matchPlan,
  localNodeTypes,
  localRelationTypes,
  localTemplateContents,
}: {
  schemaFile: DiscourseSchemaFile;
  matchPlan: SchemaImportMatchPlan;
  localNodeTypes: DiscourseNode[];
  localRelationTypes: DiscourseRelationType[];
  localTemplateContents: ReadonlyMap<string, string>;
}): SchemaConflict[] => {
  const localNodeTypesById = new Map(
    localNodeTypes.map((nodeType) => [nodeType.id, nodeType]),
  );
  const localRelationTypesById = new Map(
    localRelationTypes.map((relationType) => [relationType.id, relationType]),
  );

  const nodeTypeConflicts = schemaFile.nodeTypes.flatMap((imported) => {
    if (!matchPlan.existingNodeTypeIds.has(imported.id)) return [];
    const localId = matchPlan.nodeTypeIdMapping.get(imported.id);
    const local = localId ? localNodeTypesById.get(localId) : undefined;
    if (!local) return [];

    const changes = buildNodeTypeFieldChanges({ local, imported });
    if (changes.length === 0) return [];
    return [
      {
        category: "nodeType" as const,
        schemaId: imported.id,
        label: local.name,
        changes,
      },
    ];
  });

  const relationTypeConflicts = schemaFile.relationTypes.flatMap((imported) => {
    if (!matchPlan.existingRelationTypeIds.has(imported.id)) return [];
    const localId = matchPlan.relationTypeIdMapping.get(imported.id);
    const local = localId ? localRelationTypesById.get(localId) : undefined;
    if (!local) return [];

    const changes = buildRelationTypeFieldChanges({ local, imported });
    if (changes.length === 0) return [];
    return [
      {
        category: "relationType" as const,
        schemaId: imported.id,
        label: local.label,
        changes,
      },
    ];
  });

  const templateConflicts = schemaFile.templates.flatMap((imported) => {
    if (!matchPlan.existingTemplateNames.has(imported.name)) return [];
    const localContent = localTemplateContents.get(imported.name);
    if (localContent === undefined || localContent === imported.content) {
      return [];
    }
    return [
      {
        category: "template" as const,
        schemaId: imported.name,
        label: `${imported.name}.md`,
        changes: [
          {
            field: TEMPLATE_CONTENT_FIELD,
            localValue: localContent,
            importedValue: imported.content,
          },
        ],
      },
    ];
  });

  return [...nodeTypeConflicts, ...relationTypeConflicts, ...templateConflicts];
};
