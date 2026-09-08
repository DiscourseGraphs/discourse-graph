import React from "react";
import { getSubTree } from "roamjs-components/util";
import { OnloadArgs } from "roamjs-components/types";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import DiscourseNodeIndex from "./DiscourseNodeIndex";

const NodeIndexPage = ({
  node,
  onloadArgs,
}: {
  node: DiscourseNode;
  onloadArgs: OnloadArgs;
}): JSX.Element => {
  const indexUid = getSubTree({ parentUid: node.type, key: "Index" }).uid;
  return (
    <div className="flex flex-col gap-4 p-1">
      <DiscourseNodeIndex
        node={node}
        parentUid={indexUid}
        onloadArgs={onloadArgs}
      />
    </div>
  );
};

export default NodeIndexPage;
