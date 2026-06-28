export const contentTypes = {
  plainText: "text/plain",
  markdown: "text/markdown",
  roamMarkdown: "text/roam+markdown",
  obsidianMarkdown: "text/obsidian+markdown",
  roamJson: "application/roam+json",
  discourseGraphAtJson:
    "application/vnd.discourse-graph.atjson+json; version=1",
} as const;

export const supportedContentTypes = [
  contentTypes.plainText,
  contentTypes.markdown,
  contentTypes.roamMarkdown,
  contentTypes.obsidianMarkdown,
  contentTypes.roamJson,
  contentTypes.discourseGraphAtJson,
] as const;

export type ContentType = (typeof supportedContentTypes)[number];

export const isSupportedContentType = (value: string): value is ContentType =>
  supportedContentTypes.includes(value as ContentType);
