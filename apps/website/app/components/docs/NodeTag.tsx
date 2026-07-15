import type { CSSProperties, ReactElement, ReactNode } from "react";

const NODE_TAG_COLORS = {
  que: "#99890E", // Question
  clm: "#7DA13E", // Claim
  evd: "#DB134A", // Evidence
  src: "#3B82F6", // Source
  hyp: "#8CE99A", // Hypothesis
  res: "#4DABF7", // Result
  iss: "#E599F7", // Issue
} as const;

export type NodeTagType = keyof typeof NODE_TAG_COLORS;

const NODE_TAG_TYPES = Object.keys(NODE_TAG_COLORS) as NodeTagType[];

const isNodeTagType = (type: unknown): type is NodeTagType =>
  typeof type === "string" && type in NODE_TAG_COLORS;

const getTextColor = (backgroundColor: string): string => {
  const hex = backgroundColor.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5
    ? "#000000"
    : "#FFFFFF";
};

type NodeTagProps = {
  type: NodeTagType;
  children?: ReactNode;
};

export const NodeTag = ({ type, children }: NodeTagProps): ReactElement => {
  if (!isNodeTagType(type)) {
    throw new Error(
      `Invalid NodeTag type "${String(type)}". Expected one of: ${NODE_TAG_TYPES.join(", ")}.`,
    );
  }

  const backgroundColor = NODE_TAG_COLORS[type];

  const style: CSSProperties = {
    backgroundColor,
    color: getTextColor(backgroundColor),
    padding: "1px 10px",
    borderRadius: "999px",
    fontSize: "0.85em",
    fontWeight: 500,
    display: "inline-block",
    whiteSpace: "nowrap",
  };

  return <span style={style}>{children ?? `#${type}-candidate`}</span>;
};
