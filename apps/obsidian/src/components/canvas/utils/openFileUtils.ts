import { App, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { DiscourseNodeShape } from "~/components/canvas/shapes/DiscourseNodeShape";
import {
  extractBlockRefId,
  resolveLinkedTFileByBlockRef,
} from "~/components/canvas/stores/assetStore";
import { showToast } from "./toastUtils";

/**
 * Resolves and validates a discourse node shape to get its linked file.
 * Handles all validation and error toasts internally.
 * @returns The linked TFile if valid, null otherwise
 */
export const resolveDiscourseNodeFile = async (
  shape: DiscourseNodeShape,
  canvasFile: TFile,
  app: App,
  plugin: DiscourseGraphPlugin,
): Promise<TFile | null> => {
  const blockRefId = extractBlockRefId(shape.props.src ?? undefined);
  if (!blockRefId) {
    showToast({
      severity: "warning",
      title: "Cannot open node",
      description: "No valid block reference found",
    });
    return null;
  }

  const canvasFileCache = app.metadataCache.getFileCache(canvasFile);
  if (!canvasFileCache) {
    showToast({
      severity: "error",
      title: "Error",
      description: "Could not read canvas file",
    });
    return null;
  }

  try {
    const linkedFile = await resolveLinkedTFileByBlockRef({
      app,
      canvasFile,
      blockRefId,
      canvasFileCache,
    });

    if (!linkedFile) {
      showToast({
        severity: "warning",
        title: "Cannot open node",
        description: "Linked file not found",
      });
      return null;
    }

    return linkedFile;
  } catch (error) {
    console.error("Error resolving linked file:", error);
    showToast({
      severity: "error",
      title: "Error",
      description: "Failed to open linked file",
    });
    return null;
  }
};

export const openFileInSidebar = async (
  app: App,
  file: TFile,
): Promise<void> => {
  const rightSplit = app.workspace.rightSplit;
  const rightLeaf = app.workspace.getRightLeaf(false);

  if (rightLeaf) {
    if (rightSplit && rightSplit.collapsed) {
      rightSplit.expand();
    }
    await rightLeaf.openFile(file);
    app.workspace.setActiveLeaf(rightLeaf);
  } else {
    const leaf = app.workspace.getLeaf("split", "vertical");
    await leaf.openFile(file);
    app.workspace.setActiveLeaf(leaf);
  }
};

export const openFileInNewTab = async (
  app: App,
  file: TFile,
): Promise<void> => {
  const leaf = app.workspace.getLeaf("tab");
  await leaf.openFile(file);
  app.workspace.setActiveLeaf(leaf);
};

export const openFileInNewLeaf = async (
  app: App,
  file: TFile,
): Promise<void> => {
  const leaf = app.workspace.getLeaf("split");
  await leaf.openFile(file);
  app.workspace.setActiveLeaf(leaf);
};
 
