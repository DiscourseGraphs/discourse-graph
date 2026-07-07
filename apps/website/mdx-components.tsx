import React from "react";
import { useMDXComponents as getThemeComponents } from "nextra-theme-docs";

type MdxComponentMap = Record<string, unknown>;
type ImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

// ── Image sizing ────────────────────────────────────────────────────────────

const parseAltSize = (alt?: string): { alt: string; width?: number } => {
  if (!alt) return { alt: "" };
  const match = alt.match(/^(.*?)\s*\|\s*(\d+)\s*$/);
  if (match)
    return {
      alt: match[1]?.trim() ?? "",
      width: parseInt(match[2] ?? "0", 10),
    };
  return { alt };
};

// ── Node tag pills ──────────────────────────────────────────────────────────
// Default per-type colors live in nextra-css.css (`.node-tag[data-type="..."]`),
// which derives background/border/text from a single `--node-tag-color` via
// color-mix — the same pattern used for callouts below. The `color` prop here
// is only for one-off overrides that skip the CSS default.

type NodeTagProps = {
  type?: string;
  color?: string;
  children?: React.ReactNode;
};

const NodeTag = ({ type, color, children }: NodeTagProps) => {
  const style = color
    ? ({ "--node-tag-color": color } as React.CSSProperties)
    : undefined;
  return (
    <span className="node-tag" data-type={type} style={style}>
      {children ?? (type ? `#${type}-candidate` : "")}
    </span>
  );
};

// ── Callouts ────────────────────────────────────────────────────────────────

const CALLOUT_REGEX = /^\[!([\w-]+)\]([+-]?)\s*(.*)/s;

const CALLOUT_ICONS: Record<string, string> = {
  info: "ℹ",
  tip: "💡",
  note: "✎",
  warning: "⚠",
  caution: "⚠",
  check: "✓",
  done: "✓",
  success: "✓",
  question: "?",
  faq: "?",
  help: "?",
  fail: "✗",
  missing: "✗",
  error: "✗",
  danger: "⚡",
  abstract: "≡",
  summary: "≡",
};

const CALLOUT_COLORS: Record<string, string> = {
  info: "#4dabf7",
  tip: "#69db7c",
  note: "#74c0fc",
  warning: "#ffa94d",
  caution: "#ffa94d",
  check: "#69db7c",
  done: "#69db7c",
  success: "#69db7c",
  question: "#ffd43b",
  faq: "#ffd43b",
  help: "#ffd43b",
  fail: "#ff8787",
  missing: "#ff8787",
  error: "#ff6b6b",
  danger: "#ff6b6b",
  abstract: "#74c0fc",
  summary: "#74c0fc",
};

const Blockquote = ({ children }: React.HTMLAttributes<HTMLElement>) => {
  const childArray = React.Children.toArray(children);
  const firstElementIndex = childArray.findIndex(React.isValidElement);
  const firstElement = childArray[firstElementIndex] as React.ReactElement<{
    children: React.ReactNode;
  }>;

  if (!firstElement) return <blockquote>{children}</blockquote>;

  const pChildren = React.Children.toArray(firstElement.props.children);
  const firstText = pChildren[0];

  if (typeof firstText !== "string") return <blockquote>{children}</blockquote>;

  const match = firstText.match(CALLOUT_REGEX);
  if (!match) return <blockquote>{children}</blockquote>;

  const [, rawType, fold, titleText] = match;
  if (!rawType) return <blockquote>{children}</blockquote>;
  const type = rawType.toLowerCase();
  const isFoldable = fold === "+" || fold === "-";
  const isOpen = fold !== "-";
  const icon = CALLOUT_ICONS[type] ?? "ℹ";
  const color = CALLOUT_COLORS[type] ?? "#74c0fc";

  const titleContent = (
    <>
      <span className="callout-icon">{icon}</span>
      {titleText}
      {pChildren.slice(1)}
      {isFoldable && <span className="callout-fold">▾</span>}
    </>
  );

  const body = childArray.slice(firstElementIndex + 1);
  const TitleTag = isFoldable ? "summary" : "div";
  const WrapperTag = isFoldable ? "details" : "div";

  return (
    <WrapperTag
      className={`callout callout-${type}`}
      style={{ "--callout-color": color } as React.CSSProperties}
      {...(isFoldable && isOpen ? { open: true } : {})}
    >
      <TitleTag className="callout-title">{titleContent}</TitleTag>
      <div className="callout-body">{body}</div>
    </WrapperTag>
  );
};

// ── Export ──────────────────────────────────────────────────────────────────

export const useMDXComponents = (
  components: MdxComponentMap = {},
): MdxComponentMap => {
  const themeComponents = getThemeComponents();
  const BaseImg = themeComponents.img as
    | React.ComponentType<ImgProps>
    | undefined;

  const DocImage = ({ alt, width, ...props }: ImgProps) => {
    const { alt: cleanAlt, width: parsedWidth } = parseAltSize(alt);
    const resolvedWidth = parsedWidth ?? width;
    if (BaseImg) {
      return <BaseImg alt={cleanAlt} width={resolvedWidth} {...props} />;
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={cleanAlt} width={resolvedWidth} {...props} />;
  };

  return {
    ...themeComponents,
    img: DocImage,
    blockquote: Blockquote,
    nodetag: NodeTag,
    ...components,
  };
};

export default useMDXComponents;
