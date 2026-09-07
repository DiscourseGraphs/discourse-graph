import { debounce, MarkdownView, type TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { getNodeTypeIdFromFrontmatter } from "./discourseLinkFrontmatter";
import { refreshMarkdownEditors } from "./markdownViewRefresh";
import {
  applyDiscourseContextBadges,
  removeDiscourseContextBadges,
} from "./discourseContextOverlayPostProcessor";

const REFRESH_DEBOUNCE_MS = 300;

/** Only a discourse node's own frontmatter can change what a badge shows. */
const isDiscourseNodeFile = (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): boolean =>
  !!getNodeTypeIdFromFrontmatter(
    plugin.app.metadataCache.getFileCache(file)?.frontmatter,
  );

/**
 * Redraws both surfaces when relations or frontmatter change. Reading view is
 * refreshed in place: rerender() blanks a pane that is not currently painting.
 */
export const refreshDiscourseContextOverlaySurfaces = (
  plugin: DiscourseGraphPlugin,
): void => {
  refreshMarkdownEditors(plugin.app);
  plugin.app.workspace.iterateAllLeaves((leaf) => {
    if (!(leaf.view instanceof MarkdownView)) return;
    const el = leaf.view.previewMode?.containerEl;
    if (!el) return;
    if (!plugin.settings.showDiscourseContextOverlay) {
      removeDiscourseContextBadges(el);
      return;
    }
    const sourcePath = leaf.view.file?.path;
    if (!sourcePath) return;
    applyDiscourseContextBadges({ plugin, el, sourcePath });
  });
};

export const registerDiscourseContextOverlayRefresh = (
  plugin: DiscourseGraphPlugin,
): void => {
  const refresh = debounce(
    () => refreshDiscourseContextOverlaySurfaces(plugin),
    REFRESH_DEBOUNCE_MS,
    true,
  );

  plugin.register(plugin.relationsIndex.onChange(refresh));
  // Files that were nodes must still trigger a refresh once they stop being
  // one, or their existing badges never get removed.
  const knownNodePaths = new Set<string>();
  // "changed", not "resolved": resolved also fires while a preview renders.
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (file) => {
      if (isDiscourseNodeFile(plugin, file)) {
        knownNodePaths.add(file.path);
      } else if (!knownNodePaths.delete(file.path)) {
        return;
      }
      refresh();
    }),
  );
};
