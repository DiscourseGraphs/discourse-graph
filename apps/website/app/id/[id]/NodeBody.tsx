import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

const markdownTypes = [
  "text/markdown",
  "text/obsidian+markdown",
  "text/roam+markdown",
];

export const NodeBody = ({
  contents,
}: {
  contents: { content_type: string; text: string | null }[];
}): React.ReactElement | null => {
  const markdown = contents.find(
    (row) => row.text !== null && markdownTypes.includes(row.content_type),
  );
  if (!markdown || markdown.text === null) {
    const text = contents.find(
      (row) => row.content_type === "text/plain",
    )?.text;
    return text ? <p className="whitespace-pre-wrap">{text}</p> : null;
  }
  const source =
    markdown.content_type === "text/obsidian+markdown"
      ? markdown.text.replace(/^---\r?\n(?:[^\n]*\n)*?---(?:\r?\n|$)/, "")
      : markdown.text;
  // Insert only micromark output with raw HTML and dangerous protocols disabled.
  const html = micromark(source, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
  return (
    <article
      className="prose prose-slate max-w-none break-words"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
