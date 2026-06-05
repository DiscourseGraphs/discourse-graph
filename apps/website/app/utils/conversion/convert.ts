import showdown from "showdown";
import { JSDOM } from "jsdom";

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

const markdownTypes: Set<DocType> = new Set(["obsidian", "markdown"]);

let converter: showdown.Converter | undefined;

const init = (): showdown.Converter => {
  if (converter === undefined) converter = new showdown.Converter();
  return converter;
};

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
    return converter.makeHtml(text);
  }
  if (markdownTypes.has(dest) && source === "html") {
    return converter.makeMarkdown(text, new JSDOM().window.document);
  }
  throw new Error("Types not handled");
};
