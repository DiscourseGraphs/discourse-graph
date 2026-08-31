import getBlockProps from "./getBlockProps";
import { setBlockPropsAsync } from "./setBlockProps";
import {
  DISCOURSE_GRAPH_PROP_NAME,
  TENTATIVE_PROP_KEY,
  getReifiedRelations,
} from "./createReifiedBlock";
import {
  isJsonObject,
  readImportedSourceIdentity,
  type ImportedSourceIdentity,
} from "./importedSourceIdentity";

export type TentativeRelationInstance = {
  relationUid: string;
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
      relationUid: r.relationId,
      schemaUid: r.hasSchema,
      sourceUid: r.sourceUid,
      destinationUid: r.destinationUid,
      importedFrom: readImportedSourceIdentity(r.relationId),
    }));
};

export const acceptTentativeRelationInstance = async ({
  relationUid,
}: {
  relationUid: string;
}): Promise<void> => {
  const existing = getBlockProps(relationUid)[DISCOURSE_GRAPH_PROP_NAME];
  if (!isJsonObject(existing) || typeof existing.sourceUid !== "string") {
    throw new Error(
      "The relation block could not be read. It may have been deleted; refresh and try again.",
    );
  }
  if (existing[TENTATIVE_PROP_KEY] === undefined) return;
  const accepted = { ...existing };
  delete accepted[TENTATIVE_PROP_KEY];
  await setBlockPropsAsync(relationUid, {
    [DISCOURSE_GRAPH_PROP_NAME]: accepted,
  });
};
