import type {
  InputTextNode,
  RoamBasicNode,
  TextNode,
} from "roamjs-components/types/native";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import DEFAULT_RELATION_VALUES from "../data/defaultDiscourseRelations";
import discourseConfigRef from "./discourseConfigRef";

export type Triple = readonly [string, string, string];
export type DiscourseRelation = {
  triples: Triple[];
  id: string;
  label: string;
  source: string;
  destination: string;
  complement: string;
};

const matchNodeText = (keyword: string) => {
  return (node: RoamBasicNode | TextNode) =>
    toFlexRegex(keyword).test(node.text);
};

export const getGrammarNode = () => {
  return discourseConfigRef.tree.find(matchNodeText("grammar"));
};

export const getRelationsNode = (grammarNode = getGrammarNode()) => {
  return grammarNode?.children.find(matchNodeText("relations"));
};

const getDiscourseRelations = () => {
  const grammarNode = getGrammarNode();
  const relationsNode = getRelationsNode(grammarNode);
  const relationNodes = relationsNode?.children || DEFAULT_RELATION_VALUES;
  const discourseRelations = relationNodes.flatMap(
    (r: InputTextNode, i: number) => {
      const tree = (r?.children || []) as TextNode[];
      const data = {
        id: r.uid || `${r.text}-${i}`,
        label: r.text,
        source: getSettingValueFromTree({ tree, key: "Source" }),
        destination: getSettingValueFromTree({ tree, key: "Destination" }),
        complement: getSettingValueFromTree({ tree, key: "Complement" }),
      };
      const ifNode = tree.find(matchNodeText("if"))?.children || [];
      return ifNode.map((node) => ({
        ...data,
        triples: node.children
          .filter((t) => !/node positions/i.test(t.text))
          .map((t) => {
            const target = t.children[0]?.children?.[0]?.text || "";
            return [t.text, t.children[0]?.text, target] as const;
          }),
      }));
    }
  );

  return discourseRelations;
};

export default getDiscourseRelations;
