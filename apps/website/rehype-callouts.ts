import { visit } from "unist-util-visit";
import type { Root, Element, ElementContent, Text } from "hast";

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

export function rehypeCallouts() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element, index, parent) => {
      if (node.tagName !== "blockquote" || index == null || !parent) return;

      const firstP = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "p",
      );
      if (!firstP) return;

      const firstText = firstP.children[0];
      if (!firstText || firstText.type !== "text") return;

      const match = (firstText as Text).value.match(CALLOUT_REGEX);
      if (!match) return;

      const [, rawType, fold, titleText] = match;
      if (!rawType) return;
      const type = rawType.toLowerCase();
      const isFoldable = fold === "+" || fold === "-";
      const isOpen = fold !== "-";
      const icon = CALLOUT_ICONS[type] ?? "ℹ";
      const color = CALLOUT_COLORS[type] ?? "#74c0fc";

      // Title: extracted text + any remaining inline children from firstP
      const titleChildren: ElementContent[] = [
        {
          type: "element",
          tagName: "span",
          properties: { className: ["callout-icon"] },
          children: [{ type: "text", value: icon }],
        },
        { type: "text", value: titleText || type },
        ...(firstP.children.slice(1) as ElementContent[]),
      ];

      if (isFoldable) {
        titleChildren.push({
          type: "element",
          tagName: "span",
          properties: { className: ["callout-fold"] },
          children: [{ type: "text", value: "▾" }],
        });
      }

      // Body: blockquote children after firstP, filtering whitespace-only text nodes
      const firstPIndex = node.children.indexOf(firstP);
      const bodyChildren = node.children
        .slice(firstPIndex + 1)
        .filter(
          (c): c is ElementContent =>
            c.type !== "text" || (c as Text).value.trim() !== "",
        );

      const wrapper: Element = {
        type: "element",
        tagName: isFoldable ? "details" : "div",
        properties: {
          className: ["callout", `callout-${type}`],
          style: `--callout-color: ${color}`,
          ...(isFoldable && isOpen ? { open: true } : {}),
        },
        children: [
          {
            type: "element",
            tagName: isFoldable ? "summary" : "div",
            properties: { className: ["callout-title"] },
            children: titleChildren,
          },
          {
            type: "element",
            tagName: "div",
            properties: { className: ["callout-body"] },
            children: bodyChildren,
          },
        ],
      };

      parent.children.splice(index, 1, wrapper);
    });
  };
}
