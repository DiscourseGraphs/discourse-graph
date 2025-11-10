import fireQuery from "./fireQuery";
import getDiscourseNodes from "./getDiscourseNodes";
import getDiscourseRelations from "./getDiscourseRelations";
import type { DiscourseRelation } from "./getDiscourseRelations";
import internalError from "./internalError";

// lifted from getExportTypes

export const getRelationDataUtil = async ({
  allRelations,
  nodeLabelByType,
  local,
}: {
  allRelations: DiscourseRelation[];
  nodeLabelByType: Record<string, string>;
  local?: boolean;
}) =>
  Promise.all(
    allRelations
      .filter(
        (s) =>
          s.triples.some((t) => t[2] === "source") &&
          s.triples.some((t) => t[2] === "destination"),
      )
      .flatMap((s) => {
        const sourceLabel = nodeLabelByType[s.source];
        const targetLabel = nodeLabelByType[s.destination];
        return !sourceLabel || !targetLabel
          ? []
          : fireQuery({
              returnNode: sourceLabel,
              local,
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
            })
              .then((results) =>
                results.map((result) => ({
                  source: result.uid,
                  target: result["target-uid"],
                  relUid: s.id,
                  label: s.label,
                })),
              )
              .catch((error) => {
                internalError({
                  error,
                  type: "Get relation data",
                  userMessage: `Could not find relations of type ${s.label}`,
                });
                return [];
              });
      }),
  ).then((r) => r.flat());

const getRelationData = async (local?: boolean) => {
  const allRelations = getDiscourseRelations();
  const allNodes = getDiscourseNodes(allRelations);
  const nodeLabelByType = Object.fromEntries(
    allNodes.map((a) => [a.type, a.text]),
  );
  return await getRelationDataUtil({ allRelations, nodeLabelByType, local });
};

export default getRelationData;
