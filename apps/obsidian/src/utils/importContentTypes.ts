import {
  TEXT_MARKDOWN_CONTENT_TYPE,
  TEXT_PLAIN_CONTENT_TYPE,
} from "@repo/content-model";

export type ObsidianImportContentVariant = "direct" | "full";

type ObsidianImportContentRow = {
  variant: string | null;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  content_type: string | null;
};

export const OBSIDIAN_IMPORT_CONTENT_TYPES = [
  TEXT_PLAIN_CONTENT_TYPE,
  TEXT_MARKDOWN_CONTENT_TYPE,
] as const;

export const getContentTypeForObsidianImportVariant = (
  variant: ObsidianImportContentVariant,
): (typeof OBSIDIAN_IMPORT_CONTENT_TYPES)[number] =>
  variant === "full" ? TEXT_MARKDOWN_CONTENT_TYPE : TEXT_PLAIN_CONTENT_TYPE;

export const isObsidianImportDirectRow = (
  row: ObsidianImportContentRow,
): boolean =>
  row.variant === "direct" &&
  (row.content_type ?? TEXT_PLAIN_CONTENT_TYPE) === TEXT_PLAIN_CONTENT_TYPE;

export const isObsidianImportFullRow = (
  row: ObsidianImportContentRow,
): boolean =>
  row.variant === "full" &&
  (row.content_type ?? TEXT_MARKDOWN_CONTENT_TYPE) ===
    TEXT_MARKDOWN_CONTENT_TYPE;

export const selectObsidianImportContentRows = <
  T extends ObsidianImportContentRow,
>(
  rows: T[],
): {
  direct: T | undefined;
  full: T | undefined;
} => ({
  direct: rows.find(isObsidianImportDirectRow),
  full: rows.find(isObsidianImportFullRow),
});

export { TEXT_MARKDOWN_CONTENT_TYPE, TEXT_PLAIN_CONTENT_TYPE };
