import type { App, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseNode } from "~/types";
import { resolveLinkedFileFromSrc } from "~/utils/assetStore";

export type FrontmatterRecord = Record<string, unknown>;

export const getLinkedFileFromSrc = async (
  app: App,
  canvasFile: TFile,
  src?: string | null,
): Promise<TFile | null> => {
  if (!src) return null;
  return resolveLinkedFileFromSrc(app, canvasFile, src);
};

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

export const getNodeTypeById = (
  plugin: DiscourseGraphPlugin,
  nodeTypeId: string | null,
): DiscourseNode | null => {
  if (!nodeTypeId) return null;
  return (
    plugin.settings.nodeTypes.find((nodeType) => nodeType.id === nodeTypeId) ??
    null
  );
};

export const getNodeTypeForLinkedSrc = async (
  app: App,
  plugin: DiscourseGraphPlugin,
  canvasFile: TFile,
  src?: string | null,
): Promise<DiscourseNode | null> => {
  const file = await getLinkedFileFromSrc(app, canvasFile, src);
  if (!file) return null;
  const fm = getFrontmatterForFile(app, file);
  const id = getNodeTypeIdFromFrontmatter(fm);
  return getNodeTypeById(plugin, id);
};

export const getRelationsFromFrontmatter = (
  _frontmatter: FrontmatterRecord | null,
): unknown[] => {
  // TODO: derive relations from frontmatter when schema is defined
  return [];
};
