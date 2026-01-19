import fireQuery, { QueryArgs } from "./fireQuery";
import parseQuery from "./parseQuery";
import parseResultSettings from "./parseResultSettings";
import postProcessResults from "./postProcessResults";
import { Column } from "./types";

const runQuery = ({
  parentUid,
  inputs,
}: {
  parentUid: string;
  inputs?: QueryArgs["inputs"];
}) => {
  const queryArgs = Object.assign(parseQuery(parentUid), { inputs });
  return fireQuery(queryArgs).then((results) => {
    const settings = parseResultSettings(
      parentUid,
      [
        {
          key: "text",
          uid: window.roamAlphaAPI.util.generateUID(),
          selection: "node",
        } as Column,
      ].concat(
        queryArgs.selections.map((s) => ({
          key: s.label,
          uid: s.uid,
          selection: s.text,
        })),
      ),
    );
    return postProcessResults(results, settings);
  });
};

export default runQuery;
