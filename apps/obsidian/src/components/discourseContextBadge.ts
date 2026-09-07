import { setIcon, setTooltip, TFile } from "obsidian";
import type { DiscourseNode } from "~/types";

/** Marks a badge so a re-run can find and replace it. */
export const DISCOURSE_CONTEXT_BADGE_CLASS = "dg-discourse-context-badge";

export type DiscourseContextBadgeProps = {
  file: TFile;
  nodeType: DiscourseNode;
  relationCount: number;
  onActivate: (args: { file: TFile; anchor: HTMLElement }) => void;
};

const badgeTooltip = ({
  nodeType,
  relationCount,
}: Pick<DiscourseContextBadgeProps, "nodeType" | "relationCount">): string => {
  const relations = relationCount === 1 ? "relation" : "relations";
  return `${nodeType.name}: ${relationCount} ${relations} — open discourse context`;
};

/**
 * Inline badge next to a link to a discourse node. Plain DOM, not React, so both
 * render paths share it without mounting a React root per link.
 */
export const createDiscourseContextBadge = ({
  file,
  nodeType,
  relationCount,
  onActivate,
}: DiscourseContextBadgeProps): HTMLElement => {
  const badge = createSpan();
  badge.className = `${DISCOURSE_CONTEXT_BADGE_CLASS} inline-flex items-center gap-0.5 align-middle ml-1 px-1 rounded cursor-pointer select-none text-[10px] leading-none text-[var(--text-muted)] hover:text-[var(--text-normal)] hover:bg-[var(--background-modifier-hover)] transition-colors duration-150`;

  const icon = badge.createSpan({
    cls: "inline-flex items-center [&>svg]:h-3 [&>svg]:w-3",
  });
  setIcon(icon, "network");

  badge.createSpan({ text: String(relationCount) });

  const label = badgeTooltip({ nodeType, relationCount });
  setTooltip(badge, label);
  badge.setAttribute("aria-label", label);
  badge.setAttribute("role", "button");
  badge.setAttribute("tabindex", "0");

  const activate = (event: Event): void => {
    // Do not follow the link the badge sits next to.
    event.preventDefault();
    event.stopPropagation();
    onActivate({ file, anchor: badge });
  };

  // Otherwise the caret moves, expanding the raw [[...]] under the popover.
  badge.addEventListener("mousedown", (event: MouseEvent) => {
    event.preventDefault();
  });
  badge.addEventListener("click", activate);
  badge.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    activate(event);
  });

  return badge;
};
