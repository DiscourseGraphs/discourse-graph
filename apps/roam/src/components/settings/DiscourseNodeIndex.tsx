import React from "react";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import DiscourseNodeQueryBuilder from "./components/DiscourseNodeQueryBuilder";

const NodeIndex = ({ node }: { node: DiscourseNode }) => {
  return <DiscourseNodeQueryBuilder nodeType={node.type} nodeText={node.text} />;
};

export default NodeIndex;
