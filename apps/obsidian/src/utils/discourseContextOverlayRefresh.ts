import { debounce, type TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { getNodeTypeIdFromFrontmatter } from "./discourseLinkFrontmatter";
import { refreshMarkdownEditors } from "./markdownViewRefresh";

const REFRESH_DEBOUNCE_MS = 300;

/** Only a discourse node's own frontmatter can change what a badge shows. */
const isDiscourseNodeFile = (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): boolean =>
  !!getNodeTypeIdFromFrontmatter(
    plugin.app.metadataCache.getFileCache(file)?.frontmatter,
  );

/** Redraws the overlay when relations or a node's frontmatter change. */
export const refreshDiscourseContextOverlaySurfaces = (
  plugin: DiscourseGraphPlugin,
): void => {
  refreshMarkdownEditors(plugin.app);
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
