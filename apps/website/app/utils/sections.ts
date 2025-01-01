import { slugifyWithCounter } from "@sindresorhus/slugify";

export type Node = {
  type: string;
  attributes: Record<string, unknown>;
  children?: Node[];
};

type HeadingNode = Node & {
  type: "heading";
  attributes: {
    level: 1 | 2 | 3 | 4 | 5 | 6;
    id?: string;
    [key: string]: unknown;
  };
};

type H2Node = HeadingNode & {
  attributes: {
    level: 2;
  };
};

type H3Node = HeadingNode & {
  attributes: {
    level: 3;
  };
};

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

export type Subsection = H3Node["attributes"] & {
  id: string;
  title: string;
  children?: undefined;
};

export type Section = H2Node["attributes"] & {
  id: string;
  title: string;
  children: Array<Subsection>;
};

export function collectSections(
  nodes: Array<Node>,
  slugify = slugifyWithCounter(),
) {
  let sections: Array<Section> = [];

  for (let node of nodes) {
    if (isH2Node(node) || isH3Node(node)) {
      //   let title = getNodeText(node);
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

    sections.push(...collectSections(node.children ?? [], slugify));
  }

  return sections;
}
