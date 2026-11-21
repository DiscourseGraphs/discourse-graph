import showdown from "showdown";
import { sanitizeHtml } from "~/utils/conversion/sanitizeHtml";

const converter = new showdown.Converter();
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;

export const renderNodeBody = (
  text: string,
  platform: "Roam" | "Obsidian",
): string =>
  sanitizeHtml(
    converter.makeHtml(
      platform === "Obsidian" ? text.replace(FRONTMATTER_RE, "") : text,
    ),
  );
