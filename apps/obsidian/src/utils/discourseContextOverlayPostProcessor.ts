import {
  debounce,
  MarkdownView,
  type MarkdownPostProcessorContext,
  type TFile,
} from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  createDiscourseContextBadge,
  DISCOURSE_CONTEXT_BADGE_CLASS,
} from "~/components/discourseContextBadge";
import { openDiscourseContextPopover } from "~/components/DiscourseContextPopover";
import { resolveDiscourseLinkTarget } from "./discourseLinkUtils";
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

/**
 * Adds, updates or removes the badge on every discourse-node link in `el`.
 * Idempotent: Obsidian reuses rendered sections and re-runs post processors.
 */
export const applyDiscourseContextBadges = ({
  plugin,
  el,
  sourcePath,
}: {
  plugin: DiscourseGraphPlugin;
  el: HTMLElement;
  sourcePath: string;
}): void => {
  const links = el.querySelectorAll<HTMLAnchorElement>("a.internal-link");

  for (const link of Array.from(links)) {
    const existing = link.nextElementSibling?.hasClass(
      DISCOURSE_CONTEXT_BADGE_CLASS,
    )
      ? link.nextElementSibling
      : null;

    // data-href holds the link as written; href is resolved and URL-encoded.
    const linktext =
      link.getAttribute("data-href") ?? link.getAttribute("href");
    if (!linktext) continue;

    const target = resolveDiscourseLinkTarget({
      plugin,
      linktext,
      sourcePath,
    });
    if (!target) {
      existing?.remove();
      continue;
    }

    const badge = createDiscourseContextBadge({
      file: target.file,
      nodeType: target.nodeType,
      relationCount: target.relationCount,
      onActivate: ({ file, anchor }) =>
        openDiscourseContextPopover({
          plugin,
          file,
          anchor,
          relationCount: target.relationCount,
        }),
    });

    // Replaced, not skipped, or it keeps a count from before the last change.
    existing?.remove();
    link.insertAdjacentElement("afterend", badge);
  }
};

/** Strips every badge under `el`, for when the setting is switched off. */
const removeDiscourseContextBadges = (el: HTMLElement): void => {
  el.querySelectorAll(`.${DISCOURSE_CONTEXT_BADGE_CLASS}`).forEach((badge) =>
    badge.remove(),
  );
};

export const createDiscourseContextOverlayPostProcessor =
  (plugin: DiscourseGraphPlugin) =>
  (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    if (!plugin.settings.showDiscourseContextOverlay) return;
    if (!ctx.sourcePath) return;
    applyDiscourseContextBadges({ plugin, el, sourcePath: ctx.sourcePath });
  };

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
  // "changed", not "resolved": resolved also fires while a preview renders.
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (file) => {
      if (!isDiscourseNodeFile(plugin, file)) return;
      refresh();
    }),
  );
};
