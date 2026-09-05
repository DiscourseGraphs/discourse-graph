import { setIcon, setTooltip, TFile } from "obsidian";
import type { DiscourseNode } from "~/types";

/**
 * Marks a badge in the DOM. Both render paths check for this before adding one,
 * since Obsidian re-runs post processors over already-rendered sections.
 */
export const DISCOURSE_CONTEXT_BADGE_CLASS = "dg-discourse-context-badge";

export type DiscourseContextBadgeProps = {
  file: TFile;
  nodeType: DiscourseNode;
  relationCount: number;
  onActivate: (file: TFile) => void;
};

const badgeTooltip = ({
  nodeType,
  relationCount,
}: Pick<DiscourseContextBadgeProps, "nodeType" | "relationCount">): string => {
  const relations = relationCount === 1 ? "relation" : "relations";
  return `${nodeType.name}: ${relationCount} ${relations} — open discourse context`;
};

/**
 * The inline badge shown next to a link to a discourse node.
 *
 * Plain DOM rather than React so the CodeMirror widget and the Reading view
 * post processor can share one implementation — neither has a React root, and
 * mounting one per link would be far too heavy. Tailwind utilities work here
 * because they compile to ordinary global classes.
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
    // Stops Obsidian from following the link the badge sits next to.
    event.preventDefault();
    event.stopPropagation();
    onActivate(file);
  };

  badge.addEventListener("click", activate);
  badge.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    activate(event);
  });

  return badge;
};
