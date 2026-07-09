import React from "react";
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

type MdxComponentMap = Record<string, unknown>;

// ── Node tag pills ──────────────────────────────────────────────────────────

const NODE_TAG_COLORS: Record<string, string> = {
  que: "#f76707",
  hyp: "#8ce99a",
  evd: "#ff8787",
  res: "#4dabf7",
  iss: "#e599f7",
  clm: "#4263eb",
  src: "#adb5bd",
};

const getTextColor = (bg: string): string => {
  const hex = bg.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "#000" : "#fff";
};

type NodeTagProps = {
  type?: string;
  color?: string;
  children?: React.ReactNode;
};

const NodeTag = ({ type, color, children }: NodeTagProps) => {
  const bg = color ?? (type ? (NODE_TAG_COLORS[type] ?? "#adb5bd") : "#adb5bd");
  const textColor = getTextColor(bg);
  return (
    <span
      style={{
        backgroundColor: bg,
        color: textColor,
        padding: "1px 10px",
        borderRadius: "999px",
        fontSize: "0.85em",
        fontWeight: 500,
        display: "inline-block",
        whiteSpace: "nowrap",
      }}
    >
      {children ?? (type ? `#${type}-candidate` : "")}
    </span>
  );
};

// ── Export ──────────────────────────────────────────────────────────────────

export const useMDXComponents = (
  components: MdxComponentMap = {},
): MdxComponentMap => {
  const themeComponents = getThemeComponents();

  return {
    ...themeComponents,
    nodetag: NodeTag,
    ...components,
  };
};

export default useMDXComponents;
