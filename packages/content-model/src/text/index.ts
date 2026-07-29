export const normalizeLineEndings = (text: string): string =>
  text.replace(/\r\n?/g, "\n");

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
