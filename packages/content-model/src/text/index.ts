export const normalizeLineEndings = (text: string): string =>
  text.replace(/\r\n?/g, "\n");

export const trimBlankLines = (text: string): string =>
  text.replace(/^(?:[ \t]*\n)+/, "").replace(/(?:\n[ \t]*)+$/, "");

export const stripTitleHeading = ({
  markdown,
  title,
}: {
  markdown: string;
  title: string;
}): string => {
  const normalized = normalizeLineEndings(markdown);
  const newlineIndex = normalized.indexOf("\n");
  const firstLine =
    newlineIndex === -1 ? normalized : normalized.slice(0, newlineIndex);
  if (firstLine !== `# ${title}`) return normalized;
  if (newlineIndex === -1) return "";
  return normalized.slice(newlineIndex + 1).replace(/^\n+/, "");
};

const FRONTMATTER_DELIMITER = "---";

export const stripFrontmatter = (markdown: string): string => {
  const normalized = normalizeLineEndings(markdown);
  if (!normalized.startsWith(`${FRONTMATTER_DELIMITER}\n`)) return normalized;

  const lines = normalized.split("\n");
  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && line.trimEnd() === FRONTMATTER_DELIMITER,
  );
  if (closingIndex === -1) return normalized;

  return lines
    .slice(closingIndex + 1)
    .join("\n")
    .replace(/^\n+/, "");
};

export const dgDocumentToPlainText = ({
  document,
}: {
  document: DgDocument;
}): string => {
  const title = document.title.text.trim();
  const body = document.body.text.trim();
  return [title, body].filter((part) => part !== "").join("\n\n");
};
import type { DgDocument } from "../schema/index.js";
