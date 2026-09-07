import type { MarkdownPostProcessorContext } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import {
  badgeTargetPath,
  createDiscourseContextBadge,
  updateDiscourseContextBadge,
  DISCOURSE_CONTEXT_BADGE_CLASS,
} from "~/components/discourseContextBadge";
import { openDiscourseContextPopover } from "~/components/DiscourseContextPopover";
import { resolveDiscourseLinkTarget } from "./discourseLinkUtils";

/**
 * Adds, updates or removes the badge on every discourse-node link in `el`.
 * Idempotent: Obsidian reuses rendered sections and re-runs post processors.
 */
export const applyDiscourseContextBadges = ({
  plugin,
  el,
  sourcePath,
  skipEmbedded = false,
}: {
  plugin: DiscourseGraphPlugin;
  el: HTMLElement;
  sourcePath: string;
  /** Links inside a transclusion resolve against the embedded file, not `sourcePath`. */
  skipEmbedded?: boolean;
}): void => {
  const links = el.querySelectorAll<HTMLAnchorElement>("a.internal-link");

  for (const link of Array.from(links)) {
    if (skipEmbedded && link.closest(".internal-embed")) continue;
    const existing = link.nextElementSibling?.hasClass(
      DISCOURSE_CONTEXT_BADGE_CLASS,
    )
      ? (link.nextElementSibling as HTMLElement)
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

    // Updated rather than replaced when the target is unchanged: an open
    // popover anchored to this badge would otherwise hold a detached element.
    if (existing && badgeTargetPath(existing) === target.file.path) {
      updateDiscourseContextBadge({
        badge: existing,
        nodeType: target.nodeType,
        relationCount: target.relationCount,
      });
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

    existing?.remove();
    link.insertAdjacentElement("afterend", badge);
  }
};

/** Strips every badge under `el`, for when the setting is switched off. */
export const removeDiscourseContextBadges = (el: HTMLElement): void => {
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
