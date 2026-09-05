import {
  debounce,
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

export const createDiscourseContextOverlayPostProcessor =
  (plugin: DiscourseGraphPlugin) =>
  (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    if (!plugin.settings.showDiscourseContextOverlay) return;
    if (!ctx.sourcePath) return;

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
        sourcePath: ctx.sourcePath,
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

/**
 * Redraws both overlay surfaces when something they depend on changes outside
 * the document they render.
 *
 * Reading view has no equivalent of CM6's update cycle, so nothing re-runs the
 * post processor on its own; without this a badge keeps its original number for
 * the life of the view, including the `0` it would show if the relations index
 * was still loading when the note first rendered.
 *
 * Debounced because "resolved" fires repeatedly while the vault settles on
 * startup, and re-rendering every preview is not cheap.
 */
export const registerDiscourseContextOverlayRefresh = (
  plugin: DiscourseGraphPlugin,
): void => {
  const refresh = debounce(
    () => {
      if (!plugin.settings.showDiscourseContextOverlay) return;
      plugin.refreshDiscourseContextOverlay();
    },
    REFRESH_DEBOUNCE_MS,
    true,
  );

  plugin.register(plugin.relationsIndex.onChange(refresh));
  // A link only resolves once its target's frontmatter is cached, so a note
  // rendered before that lands needs a second pass.
  //
  // Scoped to "changed" rather than "resolved" on purpose: "resolved" also
  // fires while rendering a preview, and since the refresh re-renders previews
  // that is a loop which leaves Reading view permanently blank.
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (file) => {
      if (!isDiscourseNodeFile(plugin, file)) return;
      refresh();
    }),
  );
};
