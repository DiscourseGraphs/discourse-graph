import { parseLinktext, type MarkdownPostProcessorContext } from "obsidian";
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
 * A link inside a transclusion resolves against the embedded file, so walk the
 * `.internal-embed` chain outwards to find the file it was actually written in.
 */
const resolveLinkSourcePath = ({
  plugin,
  link,
  sourcePath,
}: {
  plugin: DiscourseGraphPlugin;
  link: HTMLElement;
  sourcePath: string;
}): string | null => {
  const embeds: HTMLElement[] = [];
  let embed = link.parentElement?.closest<HTMLElement>(".internal-embed");
  while (embed) {
    embeds.unshift(embed);
    embed = embed.parentElement?.closest<HTMLElement>(".internal-embed");
  }

  let path = sourcePath;
  for (const ancestor of embeds) {
    const src = ancestor.getAttribute("src");
    if (!src) return null;
    const file = plugin.app.metadataCache.getFirstLinkpathDest(
      parseLinktext(src).path,
      path,
    );
    if (!file) return null;
    path = file.path;
  }
  return path;
};

/** Idempotent: Obsidian reuses rendered sections and re-runs post processors. */
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
    const linkSourcePath = resolveLinkSourcePath({ plugin, link, sourcePath });
    if (!linkSourcePath) continue;
    const existing = link.nextElementSibling?.hasClass(
      DISCOURSE_CONTEXT_BADGE_CLASS,
    )
      ? (link.nextElementSibling as HTMLElement)
      : null;

    // data-href holds the link as written; href is resolved and URL-encoded.
    const linktext =
      link.getAttribute("data-href") ?? link.getAttribute("href");
    if (!linktext) {
      existing?.remove();
      continue;
    }

    const target = resolveDiscourseLinkTarget({
      plugin,
      linktext,
      sourcePath: linkSourcePath,
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
        }),
    });

    existing?.remove();
    link.insertAdjacentElement("afterend", badge);
  }
};

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
    // Rendered sections arrive detached, so an attached one is the plugin's own
    // MarkdownRenderer.render inside a modal, where the popover cannot dismiss.
    if (el.closest(".modal-container")) return;
    applyDiscourseContextBadges({ plugin, el, sourcePath: ctx.sourcePath });
  };
