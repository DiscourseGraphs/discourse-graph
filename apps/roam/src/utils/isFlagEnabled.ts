import type { RoamBasicNode } from "roamjs-components/types/native";
import getSubTree from "roamjs-components/util/getSubTree";
import toFlexRegex from "roamjs-components/util/toFlexRegex";
import discourseConfigRef from "./discourseConfigRef";

const isFlagEnabled = (flag: string, inputTree?: RoamBasicNode[]): boolean => {
  const flagParts = flag.split(".");
  const tree = inputTree || discourseConfigRef.tree;
  if (flagParts.length === 1)
    return tree.some((t) => toFlexRegex(flag).test(t.text));
  else
    return isFlagEnabled(
      flagParts.slice(1).join("."),
      getSubTree({ tree, key: flagParts[0] }).children
    );
};

export default isFlagEnabled;
