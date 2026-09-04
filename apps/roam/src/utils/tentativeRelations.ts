import { getReifiedRelations } from "./createReifiedBlock";
import { normalizeProps } from "./getBlockProps";
import {
  parseSourceIdentity,
  type ImportedSourceIdentity,
} from "./importedSourceIdentity";

export type TentativeRelationInstance = {
  instanceUid: string;
  schemaUid: string;
  sourceUid: string;
  destinationUid: string;
  importedFrom?: ImportedSourceIdentity;
};

export const getTentativeRelationInstances = async (): Promise<
  TentativeRelationInstance[]
> => {
  const relations = await getReifiedRelations();
  return relations
    .filter((r) => r.tentative === "true")
    .map((r) => ({
      instanceUid: r.relationId,
      schemaUid: r.hasSchema,
      sourceUid: r.sourceUid,
      destinationUid: r.destinationUid,
      importedFrom:
        r.importedFrom === undefined
          ? undefined
          : parseSourceIdentity(normalizeProps(r.importedFrom)),
    }));
};

// A triple is only excluded from accepted results when no accepted block
// asserts it too: a graph can hold both a tentative import and an accepted
// local twin of the same triple, and the accepted one must stay visible.
export const getTentativeOnlyRelationKeys = async (): Promise<Set<string>> => {
  const relations = await getReifiedRelations();
  const accepted = new Set<string>();
  const tentative = new Set<string>();
  for (const r of relations) {
    const key = `${r.hasSchema}|${r.sourceUid}|${r.destinationUid}`;
    (r.tentative === "true" ? tentative : accepted).add(key);
  }
  return new Set([...tentative].filter((key) => !accepted.has(key)));
};
