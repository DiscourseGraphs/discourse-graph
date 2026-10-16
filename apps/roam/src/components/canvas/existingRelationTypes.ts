import { refreshCanvasRelations } from "~/components/canvas/refreshCanvasRelations";
import { discourseContext } from "~/components/canvas/Tldraw";
import { createRelationSchema } from "~/utils/createRelationSchema";
import getDiscourseRelations, {
  type DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import { isRelationComplete } from "~/utils/isRelationComplete";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { isNewSettingsStoreEnabled } from "~/components/settings/utils/accessors";
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

// A mirrored pair (Informs / Informed By vs Informed By / Informs) is one type; the drag sets direction.
const relationTypeKey = ({ label, complement }: RelationType): string =>
  JSON.stringify([label, complement].sort());

// Hides only types the pair already has; same-label types with other complements stay listed.
export const deriveRelationTypes = ({
  relations,
  pairTypes,
}: {
  relations: TripletFields[];
  pairTypes: RelationType[];
}): RelationType[] => {
  const onPair = new Set(pairTypes.map(relationTypeKey));
  const seenIds = new Set<string>();
  const types = new Map<string, RelationType>();
  for (const relation of relations) {
    if (seenIds.has(relation.id)) continue;
    seenIds.add(relation.id);
    if (!isAcceptedRelationSchema(relation) || !isRelationComplete(relation))
      continue;
    const key = relationTypeKey(relation);
    if (onPair.has(key) || types.has(key)) continue;
    types.set(key, { label: relation.label, complement: relation.complement });
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
  // createTripletForPair accepts only an exact provisional match for this pair.
  const isAcceptedOnSave = (r: TripletFields): boolean =>
    !isAcceptedRelationSchema(r) &&
    r.label === label &&
    r.complement === complement &&
    r.source === sourceType &&
    r.destination === destinationType;
  const duplicate = complete.find(
    (r) =>
      !isAcceptedOnSave(r) &&
      sameText(r.label, label) &&
      sameText(r.complement, complement),
  );
  if (duplicate)
    return `"${duplicate.label}" already exists. Use Add existing to add it for these node types.`;

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
const SCHEMA_WRITE_RECONCILE_POLL_MS = 500;
const SCHEMA_WRITE_RECONCILE_MS = 30000;

// createRelationSchema doesn't await its settings write, so poll until the triplet is readable.
// Only the legacy store reads the cached config tree, so only it needs the (costly) refresh.
const isRelationReadable = (id: string): boolean => {
  if (!isNewSettingsStoreEnabled()) refreshConfigTree();
  return getDiscourseRelations().some((r) => r.id === id);
};

const waitForRelation = async ({
  id,
  timeoutMs,
  pollMs,
}: {
  id: string;
  timeoutMs: number;
  pollMs: number;
}): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (!isRelationReadable(id)) {
    if (Date.now() > deadline) return false;
    await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
  }
  return true;
};

// One key for a triplet in either reading: Informs A→B and Informed By B→A are the same triplet.
const tripletKey = (t: {
  label: string;
  complement: string;
  source: string;
  destination: string;
}): string =>
  JSON.stringify(
    t.label <= t.complement
      ? [t.label, t.complement, t.source, t.destination]
      : [t.complement, t.label, t.destination, t.source],
  );

// Shared across menu instances so a reopened menu can't start a second save of the same triplet.
const pendingSaves = new Map<string, Promise<string>>();

type TripletRequest = RelationType & {
  sourceType: string;
  destinationType: string;
};

// Saves in drag direction; reuses a matching triplet so repeat picks add nothing.
export const createTripletForPair = (
  request: TripletRequest,
): Promise<string> => {
  const key = tripletKey({
    ...request,
    source: request.sourceType,
    destination: request.destinationType,
  });
  const pending = pendingSaves.get(key);
  if (pending) return pending;
  const save = saveTripletForPair(request).finally(() =>
    pendingSaves.delete(key),
  );
  pendingSaves.set(key, save);
  return save;
};

const saveTripletForPair = async ({
  label,
  complement,
  sourceType,
  destinationType,
}: TripletRequest): Promise<string> => {
  // createRelationSchema finds the grammar blocks in the cached config tree.
  refreshConfigTree();
  const wanted = tripletKey({
    label,
    complement,
    source: sourceType,
    destination: destinationType,
  });
  const existing = getDiscourseRelations().find(
    (r) => !isRelationSchemaDeleted(r.id) && tripletKey(r) === wanted,
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
  if (
    await waitForRelation({
      id,
      timeoutMs: SCHEMA_WRITE_TIMEOUT_MS,
      pollMs: SCHEMA_WRITE_POLL_MS,
    })
  ) {
    refreshCanvasRelations();
    return id;
  }
  // The block exists, so a slow settings write is still a save: refresh once it lands.
  void waitForRelation({
    id,
    timeoutMs: SCHEMA_WRITE_RECONCILE_MS,
    pollMs: SCHEMA_WRITE_RECONCILE_POLL_MS,
  }).then((isReadable) => {
    if (isReadable) refreshCanvasRelations();
  });
  return id;
};
