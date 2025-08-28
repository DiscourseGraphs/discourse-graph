import type { App, TFile } from "obsidian";

export type FrontmatterRecord = Record<string, unknown>;

export const getFrontmatterForFile = (
  app: App,
  file: TFile,
): FrontmatterRecord | null => {
  return (app.metadataCache.getFileCache(file)?.frontmatter ??
    null) as FrontmatterRecord | null;
};

export const getNodeTypeIdFromFrontmatter = (
  frontmatter: FrontmatterRecord | null,
): string | null => {
  if (!frontmatter) return null;
  return (frontmatter as { nodeTypeId?: string })?.nodeTypeId ?? null;
};

export const getRelationsFromFrontmatter = (
  _frontmatter: FrontmatterRecord | null,
): unknown[] => {
  // TODO: derive relations from frontmatter when schema is defined
  return [];
};
