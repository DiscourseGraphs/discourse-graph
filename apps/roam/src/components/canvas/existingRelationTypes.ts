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

// Roam stores triplets only; a relation type is identified by label + complement, in either order.
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
    // A mirrored pair (Informs / Informed By vs Informed By / Informs) is one type; the drag sets direction.
    const key = JSON.stringify([label, complement].sort());
    if (!types.has(key)) types.set(key, { label, complement });
  }
  return [...types.values()];
};

const sameText = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

// Case-insensitive; the canvas keys relation types by label, so one label maps to one complement.
export const validateNewRelationType = ({
  label: rawLabel,
  complement: rawComplement,
  sourceType,
  destinationType,
  relations,
  shownLabels,
}: RelationType & {
  sourceType: string;
  destinationType: string;
  relations: TripletFields[];
  shownLabels: string[];
}): string | null => {
  const label = rawLabel.trim();
  const complement = rawComplement.trim();
  if (!label || !complement) return "Label and complement are required.";

  const shown = shownLabels.find(
    (s) => sameText(s, label) || sameText(s, complement),
  );
  if (shown)
    return `"${shown}" is already a relation between these node types.`;

  const complete = relations.filter(isRelationComplete);
  // createTripletForPair accepts an exact provisional match for this pair instead of adding one.
  const isAcceptedOnSave = complete.some(
    (r) =>
      !isAcceptedRelationSchema(r) &&
      r.label === label &&
      r.complement === complement &&
      r.source === sourceType &&
      r.destination === destinationType,
  );
  if (isAcceptedOnSave) return null;

  const duplicate = complete.find(
    (r) => sameText(r.label, label) && sameText(r.complement, complement),
  );
  // The Add existing picker lists only accepted types.
  if (duplicate)
    return isAcceptedRelationSchema(duplicate)
      ? `"${duplicate.label}" already exists. Use Add existing to add it for these node types.`
      : `"${duplicate.label}" already exists as an imported relation type that has not been accepted yet.`;

  const conflict = complete.find(
    (r) => sameText(r.label, label) && !sameText(r.complement, complement),
  );
  if (conflict)
    return `A relation called "${conflict.label}" already exists with complement "${conflict.complement}".`;

  // A complement reused by another type would show the same label for a reverse drag.
  const others = complete.filter(
    (r) => !(sameText(r.label, label) && sameText(r.complement, complement)),
  );
  const asLabel = others.find((r) => sameText(r.label, complement));
  if (asLabel)
    return `"${asLabel.label}" already exists as a relation. To add it the other way round, drag in the other direction and choose Add existing.`;
  const asComplement = others.find((r) => sameText(r.complement, complement));
  if (asComplement)
    return `"${asComplement.complement}" is already the complement of "${asComplement.label}".`;

  return null;
};

const SCHEMA_WRITE_POLL_MS = 50;
const SCHEMA_WRITE_TIMEOUT_MS = 3000;
const SCHEMA_WRITE_RECONCILE_MS = 30000;

// createRelationSchema doesn't await its settings write, so poll until the triplet is readable.
// The legacy store reads the cached config tree, hence the refresh on each pass.
const isRelationReadable = (id: string): boolean => {
  refreshConfigTree();
  return getDiscourseRelations().some((r) => r.id === id);
};

const waitForRelation = async ({
  id,
  timeoutMs,
}: {
  id: string;
  timeoutMs: number;
}): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (!isRelationReadable(id)) {
    if (Date.now() > deadline) return false;
    await new Promise<void>((resolve) =>
      setTimeout(resolve, SCHEMA_WRITE_POLL_MS),
    );
  }
  return true;
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
  if (await waitForRelation({ id, timeoutMs: SCHEMA_WRITE_TIMEOUT_MS })) {
    refreshCanvasRelations();
    return id;
  }
  // The block exists, so a slow settings write is still a save: refresh once it lands.
  void waitForRelation({ id, timeoutMs: SCHEMA_WRITE_RECONCILE_MS }).then(
    (isReadable) => {
      if (isReadable) refreshCanvasRelations();
    },
  );
  return id;
};
