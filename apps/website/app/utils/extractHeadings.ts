import { Node } from "~/utils/sections";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import { Element, Text } from "hast";

export const extractHeadings = async (html: string): Promise<Node[]> => {
  const parsedHtml = unified().use(rehypeParse).parse(html);

  const extractedHeadings: Node[] = [];

  const traverse = (node: Element | Text): void => {
    if (
      node.type === "element" &&
      /^h[1-6]$/.test(node.tagName) &&
      node.children
    ) {
      extractedHeadings.push({
        type: "heading",
        attributes: {
          level: parseInt(node.tagName[1] ?? "1", 10),
          content: node.children
            .map((child) =>
              child.type === "text" ? (child as Text).value : "",
            )
            .join(""),
        },
        children: [],
      });
    }

    if ("children" in node && Array.isArray(node.children)) {
      node.children.forEach((child) => traverse(child as Element | Text));
    }
  };

  if ("children" in parsedHtml && Array.isArray(parsedHtml.children)) {
    parsedHtml.children.forEach((child) => traverse(child as Element | Text));
  }

  return extractedHeadings;
};
