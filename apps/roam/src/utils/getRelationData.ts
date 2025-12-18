import fireQuery from "./fireQuery";
import getDiscourseNodes from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";
import type { DiscourseRelation } from "./getDiscourseRelations";
import internalError from "./internalError";

// lifted from getExportTypes

export const getRelationDataUtil = async (
  allRelations: DiscourseRelation[],
  nodeLabelByType: Record<string, string>,
) =>
  Promise.all(
    allRelations
      .filter(
        (s) =>
          s.triples.some((t) => t[2] === "source") &&
          s.triples.some((t) => t[2] === "destination"),
      )
      .flatMap((s) => {
        try {
          const sourceLabel = nodeLabelByType[s.source];
          const targetLabel = nodeLabelByType[s.destination];
          return !sourceLabel || !targetLabel
            ? []
            : fireQuery({
                returnNode: sourceLabel,
                conditions: [
                  {
                    relation: s.label,
                    source: sourceLabel,
                    target: targetLabel,
                    uid: s.id,
                    type: "clause",
                  },
                ],
                selections: [
                  {
                    uid: window.roamAlphaAPI.util.generateUID(),
                    text: `node:${targetLabel}`,
                    label: "target",
                  },
                ],
              }).then((results) =>
                results.map((result) => ({
                  source: result.uid,
                  target: result["target-uid"],
                  relUid: s.id,
                  label: s.label,
                })),
              );
        } catch (error) {
          internalError({
            error,
            type: "Get relation data",
            userMessage: `Could not find relations of type ${s.label}`,
          });
        }
      }),
  ).then((r) => r.flat());

const getRelationData = async () => {
  const allRelations = getDiscourseRelations();
  const allNodes = getDiscourseNodes(allRelations);
  const nodeLabelByType = Object.fromEntries(
    allNodes.map((a) => [a.type, a.text]),
  );
  return await getRelationDataUtil(allRelations, nodeLabelByType);
};

export default getRelationData;
