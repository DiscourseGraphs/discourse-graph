import { getReifiedRelations } from "./createReifiedBlock";
import {
  parseSourceIdentity,
  type ImportedSourceIdentity,
} from "./importedSourceIdentity";

export { acceptTentativeRelationInstance } from "./createReifiedBlock";

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
      importedFrom: parseSourceIdentity(r.importedFrom),
    }));
};
