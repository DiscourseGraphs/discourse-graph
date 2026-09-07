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

/**
 * Reading view's counterpart to the Live Preview extension.
 *
 * Obsidian runs post processors over rendered sections and reuses those
 * sections, so this must be safe to run repeatedly over content that already
 * has badges — hence the marker-class check per link rather than a one-shot
 * pass. The same guard covers hover previews and exports, which render through
 * this path too.
 */
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
 * Adds, updates or removes the badge on every discourse-node link inside `el`.
 *
 * Safe to run repeatedly over the same content, which it has to be: Obsidian
 * reuses rendered sections and re-runs post processors over them, and the
 * refresh below re-applies this in place rather than re-rendering.
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

    // Replaced rather than skipped: Obsidian reuses rendered sections, so a
    // badge left in place would keep showing a count from before the last
    // relation change.
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
 * Redraws both overlay surfaces when something they depend on changes outside
 * the document they render — a relation added or removed, or a target's
 * frontmatter finishing indexing.
 *
 * Reading view has no equivalent of CM6's update cycle, so nothing re-runs the
 * post processor on its own. It is refreshed by re-applying badges over the
 * already-rendered content rather than by calling previewMode.rerender():
 * rerender tears the preview down, and a pane that is not currently painting
 * never rebuilds it, leaving Reading view permanently blank.
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
  // A link only resolves once its target's frontmatter is cached, so a note
  // rendered before that lands needs a second pass.
  //
  // Scoped to "changed" rather than "resolved" on purpose: "resolved" also
  // fires while a preview renders, which would make this re-entrant.
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (file) => {
      if (!isDiscourseNodeFile(plugin, file)) return;
      refresh();
    }),
  );
};
