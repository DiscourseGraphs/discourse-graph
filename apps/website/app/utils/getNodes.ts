import matter from "gray-matter";
import { Root, Heading } from "mdast";
import { remark } from "remark";
import remarkParse from "remark-parse";
import { Node } from "~/utils/sections";
export const extractHeadings = async (markdown: string) => {
  const { content } = matter(markdown);
  const parsedMarkdown = remark().use(remarkParse).parse(content);
  // Traverse the Markdown AST and collect headings
  const extractedHeadings: Node[] = [];
  const traverse = (node: Root | Heading) => {
    if (node.type === "heading") {
      extractedHeadings.push({
        type: "heading",
        attributes: {
          level: node.depth,
          content: node.children.map((child: any) => child.value).join(""),
        },
        children: [],
      });
    }
    if (node.children) {
      node.children.forEach((child: any) => traverse(child));
    }
  };
  traverse(parsedMarkdown);

  return extractedHeadings;
};
