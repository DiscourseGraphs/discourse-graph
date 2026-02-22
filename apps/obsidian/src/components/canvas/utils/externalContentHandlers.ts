import type { Editor, VecLike } from "tldraw";
import { createShapeId } from "tldraw";
import { TFile } from "obsidian";
import { Notice } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  defaultHandleExternalUrlContent,
  type TLDefaultExternalContentHandlerOpts,
} from "tldraw";
import {
  ensureBlockRefForFile,
  extractBlockRefId,
} from "~/components/canvas/stores/assetStore";
import { getFrontmatterForFile } from "~/components/canvas/shapes/discourseNodeShapeUtils";
import {
  buildDiscourseNodeShapeRecord,
  type DiscourseNodeShape,
} from "~/components/canvas/shapes/DiscourseNodeShape";
import { getNodeTypeById } from "~/utils/typeUtils";
import { calcDiscourseNodeSize } from "~/utils/calcDiscourseNodeSize";
import { getFirstImageSrcForFile } from "~/components/canvas/shapes/discourseNodeShapeUtils";

const OBSIDIAN_URL_PREFIX = "obsidian://";

type ParsedObsidianUrl = {
  vault: string;
  filePath: string;
};

/**
 * Parse obsidian://open?vault=...&file=... URLs into vault name and decoded file path.
 * Returns null if the URL is not a valid obsidian open link.
 */
export const parseObsidianOpenUrl = (url: string): ParsedObsidianUrl | null => {
  if (!url.startsWith(OBSIDIAN_URL_PREFIX)) return null;

  try {
    const parsed = new URL(url);
    const vault = parsed.searchParams.get("vault") ?? "";
    const file = parsed.searchParams.get("file");
    if (!file) return null;
    return {
      vault,
      filePath: file,
    };
  } catch {
    return null;
  }
};

/**
 * Resolve an obsidian URL to a TFile in the current vault.
 * Returns null if the URL points to another vault or the file is not found.
 */
const resolveObsidianUrlToFile = (
  plugin: DiscourseGraphPlugin,
  parsed: ParsedObsidianUrl,
): TFile | null => {
  const currentVaultName = plugin.app.vault.getName?.() ?? "";
  if (parsed.vault && currentVaultName && parsed.vault !== currentVaultName) {
    return null;
  }

  let abstract = plugin.app.vault.getAbstractFileByPath(parsed.filePath);
  if (!(abstract instanceof TFile) && !parsed.filePath.endsWith(".md")) {
    abstract = plugin.app.vault.getAbstractFileByPath(
      `${parsed.filePath}.md`,
    );
  }
  return abstract instanceof TFile ? abstract : null;
};

/**
 * Check if the dropped file is a discourse node (has nodeTypeId in frontmatter
 * that matches a configured node type).
 */
const isDiscourseNodeFile = (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): boolean => {
  if (!file.path.endsWith(".md")) return false;
  const frontmatter = getFrontmatterForFile(plugin.app, file);
  const nodeTypeId = (frontmatter as { nodeTypeId?: string } | null)?.nodeTypeId;
  if (!nodeTypeId || typeof nodeTypeId !== "string") return false;
  return !!getNodeTypeById(plugin, nodeTypeId);
};

type HandleExternalUrlOptions = {
  editor: Editor;
  url: string;
  point?: VecLike;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  defaultHandlerOpts: TLDefaultExternalContentHandlerOpts;
};

/**
 * Handle URL drops/pastes: obsidian:// links become discourse node shapes when
 * the file is a discourse node; otherwise show a notice. Non-obsidian URLs
 * are delegated to the default bookmark handler.
 */
export const handleExternalUrlContent = async ({
  editor,
  url,
  point,
  plugin,
  canvasFile,
  defaultHandlerOpts,
}: HandleExternalUrlOptions): Promise<void> => {
  const position =
    point ??
    (editor.inputs.shiftKey
      ? editor.inputs.currentPagePoint
      : editor.getViewportPageBounds().center);

  if (url.startsWith(OBSIDIAN_URL_PREFIX)) {
    const parsed = parseObsidianOpenUrl(url);
    if (!parsed) {
      new Notice("Invalid Obsidian link. Only discourse nodes can be dropped on the canvas.");
      return;
    }

    const file = resolveObsidianUrlToFile(plugin, parsed);
    if (!file) {
      new Notice("File not found in this vault.");
      return;
    }

    if (!isDiscourseNodeFile(plugin, file)) {
      new Notice("Only discourse nodes can be dropped on the canvas.");
      return;
    }

    await createDiscourseNodeShapeAtPoint({
      editor,
      file,
      position,
      plugin,
      canvasFile,
    });
    return;
  }

  try {
    await defaultHandleExternalUrlContent(
      editor,
      { point, url },
      defaultHandlerOpts,
    );
  } catch {
    new Notice("This link cannot be added to the canvas.");
  }
};

type CreateDiscourseNodeShapeAtPointOptions = {
  editor: Editor;
  file: TFile;
  position: VecLike;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

const createDiscourseNodeShapeAtPoint = async ({
  editor,
  file,
  position,
  plugin,
  canvasFile,
}: CreateDiscourseNodeShapeAtPointOptions): Promise<void> => {
  const blockRef = await ensureBlockRefForFile({
    app: plugin.app,
    canvasFile,
    targetFile: file,
  });

  const shapes = editor.getCurrentPageShapes();
  const existing = shapes.find((s) => {
    if (s.type !== "discourse-node") return false;
    const src = (s as DiscourseNodeShape).props.src ?? "";
    return extractBlockRefId(src) === blockRef;
  }) as DiscourseNodeShape | undefined;

  if (existing) {
    editor.setSelectedShapes([existing.id]);
    editor.zoomToSelection({ animation: { duration: editor.options.animationMediumMs } });
    return;
  }

  const frontmatter = getFrontmatterForFile(plugin.app, file);
  const nodeTypeId = (frontmatter?.nodeTypeId as string) ?? "";
  const imageSrc = await getFirstImageSrcForFile(plugin.app, file);
  const { w, h } = await calcDiscourseNodeSize({
    title: file.basename,
    nodeTypeId,
    imageSrc: imageSrc ?? undefined,
    plugin,
  });

  const src = `asset:obsidian.blockref.${blockRef}`;
  const newId = createShapeId();
  const created = buildDiscourseNodeShapeRecord(editor, {
    id: newId,
    x: position.x,
    y: position.y,
    props: {
      w,
      h,
      src,
      title: file.basename,
      nodeTypeId,
      imageSrc: imageSrc ?? undefined,
      size: "m",
      fontFamily: "sans",
    },
  });

  editor.run(() => {
    editor.createShape(created);
    editor.setSelectedShapes([newId]);
    editor.markHistoryStoppingPoint("drop discourse node");
  });
};
