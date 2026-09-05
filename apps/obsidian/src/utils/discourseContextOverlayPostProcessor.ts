import type { MarkdownPostProcessorContext } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  createDiscourseContextBadge,
  DISCOURSE_CONTEXT_BADGE_CLASS,
} from "~/components/discourseContextBadge";
import { openDiscourseContextPopover } from "~/components/DiscourseContextPopover";
import { resolveDiscourseLinkTarget } from "./discourseLinkUtils";

/**
 * Reading view's counterpart to the Live Preview extension.
 *
 * Obsidian runs post processors over rendered sections and reuses those
 * sections, so this must be safe to run repeatedly over content that already
 * has badges — hence the marker-class check per link rather than a one-shot
 * pass. The same guard covers hover previews and exports, which render through
 * this path too.
 */
export const createDiscourseContextOverlayPostProcessor =
  (plugin: DiscourseGraphPlugin) =>
  (el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    if (!plugin.settings.showDiscourseContextOverlay) return;
    if (!ctx.sourcePath) return;

    const links = el.querySelectorAll<HTMLAnchorElement>("a.internal-link");

    for (const link of Array.from(links)) {
      if (link.nextElementSibling?.hasClass(DISCOURSE_CONTEXT_BADGE_CLASS)) {
        continue;
      }

      // data-href holds the link as written; href is resolved and URL-encoded.
      const linktext =
        link.getAttribute("data-href") ?? link.getAttribute("href");
      if (!linktext) continue;

      const target = resolveDiscourseLinkTarget({
        plugin,
        linktext,
        sourcePath: ctx.sourcePath,
      });
      if (!target || target.relationCount === 0) continue;

      const badge = createDiscourseContextBadge({
        file: target.file,
        nodeType: target.nodeType,
        relationCount: target.relationCount,
        onActivate: ({ file, anchor }) =>
          openDiscourseContextPopover({ plugin, file, anchor }),
      });

      link.insertAdjacentElement("afterend", badge);
    }
  };
