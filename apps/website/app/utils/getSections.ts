import { slugifyWithCounter } from "@sindresorhus/slugify";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import { Element, Text } from "hast";
import { H2Node, H3Node, HeadingNode, Node, Section } from "~/types/schema";

function isHeadingNode(node: Node): node is HeadingNode {
  return (
    node.type === "heading" &&
    [1, 2, 3, 4, 5, 6].includes(node.attributes.level as number) &&
    (typeof node.attributes.id === "string" ||
      typeof node.attributes.id === "undefined")
  );
}

function isH2Node(node: Node): node is H2Node {
  return isHeadingNode(node) && node.attributes.level === 2;
}

function isH3Node(node: Node): node is H3Node {
  return isHeadingNode(node) && node.attributes.level === 3;
}

const extractHeadings = async (html: string): Promise<Node[]> => {
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

export async function collectSections(html: string) {
  const nodes = await extractHeadings(html);
  const slugify = slugifyWithCounter();

  let sections: Array<Section> = [];

  for (let node of nodes) {
    if (isH2Node(node) || isH3Node(node)) {
      let title = node.attributes.content as string;
      if (title) {
        let id = slugify(title);
        if (isH3Node(node)) {
          if (!sections[sections.length - 1]) {
            throw new Error(
              "Cannot add `h3` to table of contents without a preceding `h2`",
            );
          }
          sections[sections.length - 1]!.children.push({
            ...node.attributes,
            id,
            title,
          });
        } else {
          sections.push({ ...node.attributes, id, title, children: [] });
        }
      }
    }
  }

  return sections;
}
