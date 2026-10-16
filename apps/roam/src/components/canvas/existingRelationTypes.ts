import { refreshCanvasRelations } from "~/components/canvas/refreshCanvasRelations";
import { discourseContext } from "~/components/canvas/Tldraw";
import { createRelationSchema } from "~/utils/createRelationSchema";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import { isRelationComplete } from "~/utils/isRelationComplete";
import refreshConfigTree from "~/utils/refreshConfigTree";
import {
  acceptImportedRelationSchema,
  isAcceptedRelationSchema,
  isProvisionalRelationSchema,
} from "~/utils/relationSchemaAcceptance";
import { isRelationSchemaDeleted } from "~/utils/relationSchemaChanges";

// Roam stores triplets only; a relation type is identified by label + complement.
export type RelationType = { label: string; complement: string };

export const getNodeTypeText = (type: string): string =>
  discourseContext.nodes[type]?.text || type;

type TripletFields = Pick<
  DiscourseRelation,
  "id" | "label" | "complement" | "source" | "destination"
>;

// The canvas tells types apart by label, so hide any type whose label or complement
// the pair already shows in either direction.
export const deriveRelationTypes = ({
  relations,
  shownLabels,
}: {
  relations: TripletFields[];
  shownLabels: string[];
}): RelationType[] => {
  const shown = new Set(shownLabels);
  const seenIds = new Set<string>();
  const types = new Map<string, RelationType>();
  for (const relation of relations) {
    if (seenIds.has(relation.id)) continue;
    seenIds.add(relation.id);
    if (!isAcceptedRelationSchema(relation) || !isRelationComplete(relation))
      continue;
    const { label, complement } = relation;
    if (shown.has(label) || shown.has(complement)) continue;
    const key = JSON.stringify([label, complement]);
    if (!types.has(key)) types.set(key, { label, complement });
  }
  return [...types.values()];
};

const SCHEMA_WRITE_POLL_MS = 50;
const SCHEMA_WRITE_TIMEOUT_MS = 3000;

// createRelationSchema doesn't await its settings write, so poll until the triplet is readable.
// The legacy store reads the cached config tree, hence the refresh on each pass.
const isRelationReadable = (id: string): boolean => {
  refreshConfigTree();
  return getDiscourseRelations().some((r) => r.id === id);
};

const waitForRelation = async (id: string): Promise<void> => {
  const deadline = Date.now() + SCHEMA_WRITE_TIMEOUT_MS;
  while (!isRelationReadable(id)) {
    if (Date.now() > deadline)
      throw new Error(`Relation ${id} was not readable after saving`);
    await new Promise<void>((resolve) =>
      setTimeout(resolve, SCHEMA_WRITE_POLL_MS),
    );
  }
};

// Saves in drag direction; reuses a matching triplet so repeat picks add nothing.
export const createTripletForPair = async ({
  label,
  complement,
  sourceType,
  destinationType,
}: RelationType & {
  sourceType: string;
  destinationType: string;
}): Promise<string> => {
  // createRelationSchema finds the grammar blocks in the cached config tree.
  refreshConfigTree();
  const existing = getDiscourseRelations().find(
    (r) =>
      !isRelationSchemaDeleted(r.id) &&
      r.label === label &&
      r.complement === complement &&
      r.source === sourceType &&
      r.destination === destinationType,
  );
  if (existing) {
    // A matching imported triplet is accepted rather than duplicated.
    if (isProvisionalRelationSchema(existing.id))
      await acceptImportedRelationSchema(existing.id);
    refreshCanvasRelations();
    return existing.id;
  }
  const id = await createRelationSchema({
    label,
    complement,
    source: sourceType,
    destination: destinationType,
  });
  await waitForRelation(id);
  refreshCanvasRelations();
  return id;
};
