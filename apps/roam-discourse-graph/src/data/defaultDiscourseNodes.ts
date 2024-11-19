import { DiscourseNode } from "~/utils/getDiscourseNodes";

const INITIAL_NODE_VALUES: Partial<DiscourseNode>[] = [
  {
    type: "_CLM-node",
    format: "[[CLM]] - {content}",
    text: "Claim",
    shortcut: "C",
    graphOverview: true,
    canvasSettings: {
      color: "7DA13E",
    },
  },
  {
    type: "_QUE-node",
    format: "[[QUE]] - {content}",
    text: "Question",
    shortcut: "Q",
    graphOverview: true,
    canvasSettings: {
      color: "99890e",
    },
  },
  {
    type: "_EVD-node",
    format: "[[EVD]] - {content} - {Source}",
    text: "Evidence",
    shortcut: "E",
    graphOverview: true,
    canvasSettings: {
      color: "DB134A",
    },
  },
  {
    type: "_SRC-node",
    format: "@{content}",
    text: "Source",
    shortcut: "S",
    graphOverview: true,
    canvasSettings: {
      color: "9E9E9E",
    },
  },
];

export default INITIAL_NODE_VALUES;
