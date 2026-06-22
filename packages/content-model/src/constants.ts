export const TEXT_PLAIN_CONTENT_TYPE = "text/plain";
export const TEXT_MARKDOWN_CONTENT_TYPE = "text/markdown";
export const TEXT_ROAM_MARKDOWN_CONTENT_TYPE = "text/roam+markdown";
export const TEXT_OBSIDIAN_MARKDOWN_CONTENT_TYPE = "text/obsidian+markdown";
export const APPLICATION_ROAM_JSON_CONTENT_TYPE = "application/roam+json";
export const DG_ATJSON_CONTENT_TYPE =
  "application/vnd.discourse-graph.atjson+json; version=1";

export const CONTENT_TYPES = [
  TEXT_PLAIN_CONTENT_TYPE,
  TEXT_MARKDOWN_CONTENT_TYPE,
  TEXT_ROAM_MARKDOWN_CONTENT_TYPE,
  TEXT_OBSIDIAN_MARKDOWN_CONTENT_TYPE,
  APPLICATION_ROAM_JSON_CONTENT_TYPE,
  DG_ATJSON_CONTENT_TYPE,
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const DG_DOCUMENT_VERSION = "dg-content-model/v1";
