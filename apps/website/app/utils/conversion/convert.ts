import showdown from "showdown";
import { JSDOM } from "jsdom";
import { escapeHtml } from "~/utils/conversion/sanitizeHtml";

export type DocType = "obsidian" | "roam" | "html" | "markdown";

export const MIMETYPES: Record<DocType, string> = {
  obsidian: "text/x-obsidian",
  markdown: "text/markdown",
  roam: "application/x-roam+json",
  html: "text/html",
};

export const DOCTYPES: Record<string, DocType> = Object.fromEntries(
  Object.entries(MIMETYPES).map(([a, b]) => [b, a as DocType]),
);

const markdownTypes: Set<DocType> = new Set(["obsidian", "roam", "markdown"]);

let converter: showdown.Converter | undefined;

const init = (): showdown.Converter => {
  if (converter === undefined) converter = new showdown.Converter();
  return converter;
};

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

// Obsidian notes start with YAML frontmatter: metadata, kept apart from the body.
export const splitFrontmatter = (
  text: string,
): { frontmatter?: string; body: string } => {
  const match = FRONTMATTER_RE.exec(text);
  if (!match) return { body: text };
  return { frontmatter: match[1], body: text.substring(match[0].length) };
};

const frontmatterHtml = ({
  frontmatter,
  collapsible,
}: {
  frontmatter: string;
  collapsible: boolean;
}): string => {
  const code = `<pre class="frontmatter"><code class="language-yaml">${escapeHtml(frontmatter)}</code></pre>`;
  // "Properties" is Obsidian's name for the frontmatter.
  return collapsible
    ? `<details class="frontmatter"><summary>Properties</summary>${code}</details>\n`
    : `${code}\n`;
};

const markdownToHtml = ({
  text,
  source,
  collapsibleFrontmatter,
}: {
  text: string;
  source: DocType;
  collapsibleFrontmatter: boolean;
}): string => {
  converter = init();
  if (source !== "obsidian") return converter.makeHtml(text);
  const { frontmatter, body } = splitFrontmatter(text);
  return (
    (frontmatter
      ? frontmatterHtml({ frontmatter, collapsible: collapsibleFrontmatter })
      : "") + converter.makeHtml(body)
  );
};

// HTML for a web view, where the frontmatter folds away instead of showing
// as a code block.
export const toWebViewHtml = ({
  text,
  source,
}: {
  text: string;
  source: DocType;
}): string =>
  markdownTypes.has(source)
    ? markdownToHtml({ text, source, collapsibleFrontmatter: true })
    : convert(text, source, "html");

export const convert = (
  text: string,
  source: DocType,
  dest: DocType,
): string => {
  if (source === dest) return text;
  // punt details
  if (markdownTypes.has(source) && markdownTypes.has(dest)) return text;
  converter = init();
  if (markdownTypes.has(source) && dest === "html") {
    return markdownToHtml({ text, source, collapsibleFrontmatter: false });
  }
  if (markdownTypes.has(dest) && source === "html") {
    return converter.makeMarkdown(text, new JSDOM().window.document);
  }
  throw new Error("Types not handled");
};
