import type { ZodIssue } from "zod";
import type {
  CrossAppBase,
  CrossAppRelationTypeSchema,
  CrossAppUpsertData,
  LocalId,
} from "../crossAppContracts";
import { crossAppUpsertDataValidator } from "../crossAppValidators";
import type { Json, Tables } from "../dbTypes";
import type { LocalConceptDataInput } from "../inputTypes";
import {
  crossAppNodeSchemaToDbConcept,
  crossAppNodeToDbConcept,
  crossAppRelationToDbConcept,
  crossAppRelationTripleSchemaToDbConcept,
  crossAppRelationTypeSchemaToDbConcept,
} from "./crossAppConverters";
import { isRid, ridToSpaceUriAndLocalId } from "./rid";

const UPSERT_KINDS = crossAppUpsertDataValidator.keyof().options;

type UpsertKind = (typeof UPSERT_KINDS)[number];

type ItemOf<K extends UpsertKind> = NonNullable<CrossAppUpsertData[K]>[number];

// Fields the contract allows but no converter writes yet. They are refused, not
// dropped. Remove an entry once the route writes that field.
const UNWRITTEN_FIELDS: { [K in UpsertKind]?: keyof ItemOf<K> } = {
  nodeSchemas: "metadata",
  relationTypeSchemas: "metadata",
  relationTripleSchemas: "metadata",
  nodes: "assets",
};

type UpsertIssue = { path: (string | number)[]; message: string };

type UpsertEntry = {
  localId: LocalId;
  kind: UpsertKind;
  concept: LocalConceptDataInput;
};

type UpsertFailure = Omit<UpsertEntry, "concept"> & {
  reason: "unique_conflict" | "error";
};

export type StoredSchema = Pick<
  Tables<"my_concepts">,
  "source_local_id" | "literal_content"
>;

type RelationLabels = Pick<CrossAppRelationTypeSchema, "label" | "complement">;

const upsertItems = (
  data: CrossAppUpsertData,
): { kind: UpsertKind; index: number; item: CrossAppBase }[] =>
  UPSERT_KINDS.flatMap((kind) => {
    const items: CrossAppBase[] = data[kind] ?? [];
    return items.map((item, index) => ({ kind, index, item }));
  });

const toUpsertIssues = (issue: ZodIssue): UpsertIssue[] => {
  if (issue.code === "invalid_union") {
    // A union reports its failure at its own path; the branch with the fewest
    // issues is the one the caller meant, and its issues name the field.
    const closest = issue.unionErrors.reduce((best, error) =>
      error.issues.length < best.issues.length ? error : best,
    );
    return closest.issues.flatMap(toUpsertIssues);
  }
  return [{ path: issue.path, message: issue.message }];
};

const findItemIssues = ({
  data,
  spaceUrl,
}: {
  data: CrossAppUpsertData;
  spaceUrl: string;
}): UpsertIssue[] => {
  const seen = new Set<LocalId>();
  return upsertItems(data).flatMap(({ kind, index, item }) => {
    const issues: UpsertIssue[] = [];
    const unwritten = UNWRITTEN_FIELDS[kind];
    if (seen.has(item.localId))
      issues.push({
        path: [kind, index, "localId"],
        message: "Another item in the body has this local id",
      });
    seen.add(item.localId);
    // An item's own rid sets the space its row is written to, so it must name
    // the space in the path. A RID used as a reference may name any space.
    if (
      item.rid !== undefined &&
      ridToSpaceUriAndLocalId(item.rid).spaceUri !== spaceUrl
    )
      issues.push({
        path: [kind, index, "rid"],
        message: "The rid names a space other than the one in the path",
      });
    if (unwritten !== undefined && unwritten in item)
      issues.push({
        path: [kind, index, unwritten],
        message: "This route does not write this field yet",
      });
    return issues;
  });
};

// upsert_concepts stores every inline content with scale "document", so another
// scale is refused, not rewritten.
const findContentScaleIssues = (data: CrossAppUpsertData): UpsertIssue[] =>
  (data.nodes ?? []).flatMap((node, index) =>
    Object.entries(node.content).flatMap(([variant, content]) =>
      content.scale === undefined || content.scale === "document"
        ? []
        : [
            {
              path: ["nodes", index, "content", variant, "scale"],
              message: "This route stores inline content as a document",
            },
          ],
    ),
  );

// Inline content is written to its node's space, so a content's own rid must
// name that space too.
const findContentRidIssues = ({
  data,
  spaceUrl,
}: {
  data: CrossAppUpsertData;
  spaceUrl: string;
}): UpsertIssue[] =>
  (data.nodes ?? []).flatMap((node, index) =>
    Object.entries(node.content).flatMap(([variant, content]) =>
      content.rid === undefined ||
      ridToSpaceUriAndLocalId(content.rid).spaceUri === spaceUrl
        ? []
        : [
            {
              path: ["nodes", index, "content", variant, "rid"],
              message: "The rid names a space other than the one in the path",
            },
          ],
    ),
  );

// upsert_concepts stores a node or relation whose RID type names no concept with
// a NULL schema_id and no error, and the schema check looks up local ids only, so
// a RID type is refused until a caller needs one.
const findRidTypeIssues = (data: CrossAppUpsertData): UpsertIssue[] =>
  [
    ...(data.nodes ?? []).map((node, index) => ({
      path: ["nodes", index, "nodeType"],
      type: node.nodeType,
    })),
    ...(data.relations ?? []).map((relation, index) => ({
      path: ["relations", index, "relationType"],
      type: relation.relationType,
    })),
  ].flatMap(({ path, type }) =>
    isRid(type)
      ? [{ path, message: "This route does not take a RID type yet" }]
      : [],
  );

type ParseResult =
  | { success: true; data: CrossAppUpsertData }
  | { success: false; issues: UpsertIssue[] };

const refuse = (issues: UpsertIssue[]): ParseResult => ({
  success: false,
  issues,
});

export const parseUpsertData = ({
  body,
  spaceUrl,
}: {
  body: unknown;
  spaceUrl: string;
}): ParseResult => {
  let result: ReturnType<typeof crossAppUpsertDataValidator.safeParse>;
  try {
    result = crossAppUpsertDataValidator.safeParse(body);
  } catch (error) {
    // Zod recurses once per nesting level of `metadata` and throws near 2,000
    // levels instead of returning a failure.
    if (error instanceof RangeError)
      return refuse([{ path: [], message: "The body is nested too deeply" }]);
    throw error;
  }
  if (!result.success)
    return refuse(result.error.issues.flatMap(toUpsertIssues));
  const issues = [
    ...findItemIssues({ data: result.data, spaceUrl }),
    ...findContentScaleIssues(result.data),
    ...findContentRidIssues({ data: result.data, spaceUrl }),
    ...findRidTypeIssues(result.data),
  ];
  if (issues.length > 0) return refuse(issues);
  return { success: true, data: result.data };
};

// upsert_concepts stores a node or relation whose schema is unknown with a NULL
// schema_id and no error. A triple naming its relation type takes that type's
// label and complement, so it must be in the body or this space, not a RID.
export const schemaReferences = (data: CrossAppUpsertData): LocalId[] => {
  const relationTypeIds = new Set(
    (data.relationTypeSchemas ?? []).map((s) => s.localId),
  );
  const schemaIds = new Set([
    ...relationTypeIds,
    ...(data.nodeSchemas ?? []).map((s) => s.localId),
    ...(data.relationTripleSchemas ?? []).map((s) => s.localId),
  ]);
  const references = [
    ...(data.nodeSchemas ?? []).flatMap((s) =>
      Object.values(s.slotDefinitions ?? {}),
    ),
    ...(data.relationTripleSchemas ?? []).flatMap((s) => [
      s.sourceType,
      s.destinationType,
    ]),
    ...(data.nodes ?? []).map((n) => n.nodeType),
    ...(data.relations ?? []).map((r) => r.relationType),
  ].filter(
    (id): id is LocalId => id !== undefined && !isRid(id) && !schemaIds.has(id),
  );
  const relationTypes = (data.relationTripleSchemas ?? []).flatMap((s) =>
    s.relation === undefined || relationTypeIds.has(s.relation)
      ? []
      : [s.relation],
  );
  return [...new Set([...references, ...relationTypes])];
};

const relationLabelsById = ({
  data,
  storedSchemas,
}: {
  data: CrossAppUpsertData;
  storedSchemas: StoredSchema[];
}): Map<LocalId, RelationLabels> =>
  new Map([
    ...storedSchemas.flatMap(({ source_local_id, literal_content }) => {
      const { label, complement } = literal_content as Record<string, Json>;
      return source_local_id !== null &&
        typeof label === "string" &&
        typeof complement === "string"
        ? [[source_local_id, { label, complement }] as const]
        : [];
    }),
    ...(data.relationTypeSchemas ?? []).map((s) => [s.localId, s] as const),
  ]);

export const findMissingSchemas = ({
  data,
  storedSchemas,
}: {
  data: CrossAppUpsertData;
  storedSchemas: StoredSchema[];
}): LocalId[] => {
  const storedIds = new Set(storedSchemas.map((s) => s.source_local_id));
  const relationLabels = relationLabelsById({ data, storedSchemas });
  const tripleRelations = new Set(
    (data.relationTripleSchemas ?? []).map((s) => s.relation),
  );
  return schemaReferences(data).filter((id) =>
    tripleRelations.has(id) ? !relationLabels.has(id) : !storedIds.has(id),
  );
};

const relatedConcepts = (concept: LocalConceptDataInput): string[] =>
  [
    ...(Object.values(
      concept.local_reference_content ?? {},
    ).flat() as unknown[]),
    concept.schema_represented_by_local_id,
  ].filter((id): id is string => typeof id === "string");

// upsert_concepts resolves a reference only to a row already written. Local ids
// are caller input and may be "constructor", so they key a Map, not an object.
// The walk keeps its own stack: a chain of thousands of references would overflow
// the call stack. A reference written as a RID in this space names the same row
// as its local id, so it is looked up by that local id.
const orderByDependency = ({
  entries,
  spaceUrl,
}: {
  entries: UpsertEntry[];
  spaceUrl: string;
}): UpsertEntry[] => {
  const byId = new Map(entries.map((e) => [e.localId, e]));
  const processed = new Set<string>();
  const ordered: UpsertEntry[] = [];
  const toLocalId = (reference: string): string => {
    const { spaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(reference);
    return spaceUri === spaceUrl ? sourceLocalId : reference;
  };
  const enter = (entry: UpsertEntry) => {
    processed.add(entry.localId);
    return {
      entry,
      pending: relatedConcepts(entry.concept).map(toLocalId).reverse(),
    };
  };
  for (const root of entries) {
    if (processed.has(root.localId)) continue;
    const stack = [enter(root)];
    for (let top = stack.at(-1); top !== undefined; top = stack.at(-1)) {
      const id = top.pending.pop();
      if (id === undefined) {
        ordered.push(top.entry);
        stack.pop();
        continue;
      }
      const related = byId.get(id);
      if (related !== undefined && !processed.has(id))
        stack.push(enter(related));
    }
  }
  return ordered;
};

export const toOrderedEntries = ({
  data,
  storedSchemas,
  spaceUrl,
}: {
  data: CrossAppUpsertData;
  storedSchemas: StoredSchema[];
  spaceUrl: string;
}): UpsertEntry[] => {
  const relationLabels = relationLabelsById({ data, storedSchemas });
  const converters: {
    [K in UpsertKind]: (item: ItemOf<K>) => LocalConceptDataInput;
  } = {
    nodeSchemas: crossAppNodeSchemaToDbConcept,
    relationTypeSchemas: crossAppRelationTypeSchemaToDbConcept,
    relationTripleSchemas: (triple) => {
      const concept = crossAppRelationTripleSchemaToDbConcept(
        triple,
        triple.relation === undefined
          ? undefined
          : relationLabels.get(triple.relation),
      );
      if (concept === undefined)
        throw new Error(`No relation type found for triple ${triple.localId}`);
      return concept;
    },
    nodes: crossAppNodeToDbConcept,
    relations: crossAppRelationToDbConcept,
  };
  const toEntries = <K extends UpsertKind>(kind: K): UpsertEntry[] =>
    (data[kind] ?? []).map((item) => ({
      localId: item.localId,
      kind,
      concept: converters[kind](item),
    }));
  return orderByDependency({
    entries: UPSERT_KINDS.flatMap((kind) => toEntries(kind)),
    spaceUrl,
  });
};

// upsert_concepts returns one id per input row, in input order: -1 for any
// unique violation, such as a name or a Content clash, and -2 for any other error.
export const mapUpsertResults = ({
  entries,
  ids,
}: {
  entries: UpsertEntry[];
  ids: number[];
}): { upserted: Record<LocalId, number>; failed: UpsertFailure[] } => {
  const upserted: [LocalId, number][] = [];
  const failed: UpsertFailure[] = [];
  entries.forEach(({ localId, kind }, index) => {
    const id = ids[index];
    if (id !== undefined && id >= 0) upserted.push([localId, id]);
    else
      failed.push({
        localId,
        kind,
        reason: id === -1 ? "unique_conflict" : "error",
      });
  });
  return { upserted: Object.fromEntries(upserted), failed };
};
