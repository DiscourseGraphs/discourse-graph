import { TFile } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import { PluginProvider } from "~/components/PluginContext";
import { RelationshipSection } from "~/components/RelationshipSection";
import {
  countDisplayableRelations,
  getEndpointIdsFromFrontmatter,
} from "~/utils/discourseLinkFrontmatter";
import { getRelationTypeById } from "~/utils/typeUtils";

const countRelationsForFile = (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): number => {
  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;
  const endpointIds = getEndpointIdsFromFrontmatter(frontmatter);
  return countDisplayableRelations({
    relations: plugin.relationsIndex.getRelationsForEndpointIds(endpointIds),
    isConfiguredType: (id) => !!getRelationTypeById(plugin, id),
  });
};

const POPOVER_CLASS = "dg-discourse-context-popover";
const VIEWPORT_MARGIN = 8;
const EMPTY_MESSAGE = "No discourse relation found";

const positionPopover = (popover: HTMLElement, anchor: HTMLElement): void => {
  // The anchor's own window, or a popout gets clamped to the wrong viewport.
  const win = anchor.ownerDocument.defaultView ?? window;
  const anchorRect = anchor.getBoundingClientRect();
  const { width, height } = popover.getBoundingClientRect();

  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, anchorRect.left),
    Math.max(VIEWPORT_MARGIN, win.innerWidth - width - VIEWPORT_MARGIN),
  );

  const spaceBelow = win.innerHeight - anchorRect.bottom;
  // Open upward only when that genuinely has more room, so a popover taller
  // than either side still lands on the roomier one instead of clipping.
  const openUpward =
    spaceBelow < height + VIEWPORT_MARGIN && anchorRect.top > spaceBelow;
  const top = openUpward
    ? Math.max(VIEWPORT_MARGIN, anchorRect.top - height - 4)
    : anchorRect.bottom + 4;

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
};

type PopoverOptions = {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  anchor: HTMLElement;
  relationCount: number;
};

/**
 * Reuses RelationshipSection so it cannot disagree with the sidebar panel.
 * Only one is open at a time.
 */
class DiscourseContextPopover {
  private containerEl: HTMLElement;
  private root: Root;
  private plugin: DiscourseGraphPlugin;
  private win: Window;
  private reposition: () => void = () => {};
  private resizeObserver: ResizeObserver | null = null;
  private emptyEl: HTMLElement | null = null;
  private cleanupListeners: (() => void)[] = [];

  constructor({ plugin, file, anchor, relationCount }: PopoverOptions) {
    this.plugin = plugin;
    const doc = anchor.ownerDocument;
    this.win = doc.defaultView ?? window;
    this.containerEl = doc.body.createDiv({ cls: POPOVER_CLASS });
    this.containerEl.addClass(
      "fixed",
      "z-50",
      "max-h-[60vh]",
      "w-80",
      "overflow-y-auto",
      "rounded-md",
      "border",
      "border-solid",
      "border-[var(--background-modifier-border)]",
      "bg-[var(--background-primary)]",
      "p-3",
      "shadow-lg",
    );

    // CurrentRelationships renders nothing when empty, leaving a bare button.
    if (relationCount === 0) {
      this.emptyEl = this.containerEl.createDiv({
        cls: "mb-2 text-sm text-[var(--text-muted)]",
        text: EMPTY_MESSAGE,
      });
      // It lives outside React, so RelationshipSection cannot clear it when the
      // first relation is added from this very popover.
      this.cleanupListeners.push(
        plugin.relationsIndex.onChange(() => {
          if (countRelationsForFile(plugin, file) === 0) return;
          this.emptyEl?.remove();
          this.emptyEl = null;
        }),
      );
    }

    const reactHost = this.containerEl.createDiv();
    this.root = createRoot(reactHost);
    this.root.render(
      <PluginProvider plugin={this.plugin}>
        <RelationshipSection activeFile={file} />
      </PluginProvider>,
    );

    // A React 18 root commits async, so measure again after paint and on resize.
    positionPopover(this.containerEl, anchor);
    this.reposition = () => positionPopover(this.containerEl, anchor);
    this.win.requestAnimationFrame(this.reposition);
    this.resizeObserver = new ResizeObserver(this.reposition);
    this.resizeObserver.observe(this.containerEl);

    this.registerDismissListeners();
  }

  private registerDismissListeners(): void {
    const doc = this.containerEl.ownerDocument;
    const closeIfOutside = (event: MouseEvent): void => {
      if (this.containerEl.contains(event.target as Node)) return;
      // AbstractInputSuggest mounts its list on body, so a click picking a node
      // for a new relation would otherwise dismiss the popover behind it.
      if ((event.target as Element)?.closest?.(".suggestion-container")) return;
      this.close();
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      this.close();
    };
    // Scrolling the note dismisses; scrolling the popover's own content must not.
    const closeOnScroll = (event: Event): void => {
      if (this.containerEl.contains(event.target as Node)) return;
      this.close();
    };

    // Deferred so the opening click is not read as an outside click.
    const attach = this.win.setTimeout(() => {
      doc.addEventListener("click", closeIfOutside, true);
    }, 0);

    doc.addEventListener("keydown", closeOnEscape);
    // Capture phase: scrolling happens inside panes, not on window.
    doc.addEventListener("scroll", closeOnScroll, true);

    this.cleanupListeners.push(() => {
      this.win.clearTimeout(attach);
      doc.removeEventListener("click", closeIfOutside, true);
      doc.removeEventListener("keydown", closeOnEscape);
      doc.removeEventListener("scroll", closeOnScroll, true);
    });
  }

  close(): void {
    for (const cleanup of this.cleanupListeners) cleanup();
    this.cleanupListeners = [];
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    // Deferred: unmounting during React's event handling warns.
    const root = this.root;
    this.win.setTimeout(() => root.unmount(), 0);
    this.containerEl.remove();
    if (activePopover === this) activePopover = null;
  }
}

let activePopover: DiscourseContextPopover | null = null;

export const openDiscourseContextPopover = (options: PopoverOptions): void => {
  activePopover?.close();
  activePopover = new DiscourseContextPopover(options);
};

export const closeDiscourseContextPopover = (): void => {
  activePopover?.close();
};
