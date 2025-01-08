import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";

function remarkHeadingId() {
  return (tree: any) => {
    visit(tree, "heading", (node) => {
      const text = toString(node);
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      node.data = {
        hName: `h${node.depth}`,
        hProperties: { id },
      };
    });
  };
}

export async function getHtmlFromMarkdown(markdown: string): Promise<string> {
  if (!markdown) {
    throw new Error('Markdown content is required');
  }

  try {
    const htmlString = await unified()
      .use(remarkParse)
      .use(remarkHeadingId)
      .use(remarkRehype)
      .use(rehypeStringify)
      .process(markdown);
    return htmlString.toString();
  } catch (error) {
    console.error('Error processing markdown:', error);
    throw new Error('Failed to process markdown content');
  }
}
