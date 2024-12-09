import { RoamBasicNode } from "roamjs-components/types/native";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import { Column, Condition, Selection } from "./types";

const roamNodeToCondition = ({
  uid,
  children,
  text,
}: RoamBasicNode): Condition => {
  const type = (
    isNaN(Number(text))
      ? text
      : !!getSubTree({ tree: children, key: "not" }).uid
        ? "not"
        : "clause"
  ) as Condition["type"];
  return type === "clause" || type === "not"
    ? {
        uid,
        source: getSettingValueFromTree({ tree: children, key: "source" }),
        target: getSettingValueFromTree({ tree: children, key: "target" }),
        relation: getSettingValueFromTree({
          tree: children,
          key: "relation",
        }),
        type,

        // @deprecated
        not: type === "not" || !!getSubTree({ tree: children, key: "not" }).uid,
      }
    : {
        uid,
        type,
        conditions: children.map((node) =>
          node.children.map(roamNodeToCondition),
        ),
      };
};

type ParseQuery = (q: RoamBasicNode | string) => {
  returnNode: string;
  conditions: Condition[];
  selections: Selection[];
  customNode: string;
  returnNodeUid: string;
  conditionsNodesUid: string;
  selectionsNodesUid: string;
  customNodeUid: string;
  isCustomEnabled: boolean;
  columns: Column[];
};

export const DEFAULT_RETURN_NODE = "node";

export const parseQuery: ParseQuery = (parentUidOrNode) => {
  const queryNode =
    typeof parentUidOrNode === "string"
      ? getSubTree({ key: "scratch", parentUid: parentUidOrNode })
      : parentUidOrNode;
  const { uid, children } = queryNode;
  const getOrCreateUid = (sub: RoamBasicNode, text: string) => {
    if (sub.uid) return sub.uid;
    const newUid = window.roamAlphaAPI.util.generateUID();
    createBlock({
      node: { text, uid: newUid },
      parentUid: uid,
    });
    return newUid;
  };
  const conditionsNode = getSubTree({
    tree: children,
    key: "conditions",
  });
  const conditionsNodesUid = getOrCreateUid(conditionsNode, "conditions");
  const conditions = conditionsNode.children.map(roamNodeToCondition);

  const selectionsNode = getSubTree({ tree: children, key: "selections" });
  const selectionsNodesUid = getOrCreateUid(selectionsNode, "selections");

  const selections = selectionsNode.children.map(({ uid, text, children }) => ({
    uid,
    text,
    label: children?.[0]?.text || "",
  }));

  const customBlock = getSubTree({ tree: children, key: "custom" });
  const customNodeUid = getOrCreateUid(customBlock, "custom");
  const returnNodeUid = `returnuid`;
  return {
    returnNode: DEFAULT_RETURN_NODE,
    conditions,
    selections,
    customNode: customBlock.children[0]?.text || "",
    returnNodeUid,
    conditionsNodesUid,
    selectionsNodesUid,
    customNodeUid,
    isCustomEnabled: customBlock.children[1]?.text === "enabled",
    columns: [
      {
        key:
          selections.find((s) => s.text === DEFAULT_RETURN_NODE)?.label ||
          "text",
        uid: returnNodeUid,
        selection: DEFAULT_RETURN_NODE,
      },
    ].concat(
      selections
        .filter((s) => s.text !== DEFAULT_RETURN_NODE)
        .map((s) => ({ uid: s.uid, key: s.label, selection: s.text })),
    ),
  };
};

export default parseQuery;
