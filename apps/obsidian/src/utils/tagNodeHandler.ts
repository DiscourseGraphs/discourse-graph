/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/naming-convention */
import { App, Editor, Notice, MarkdownView } from "obsidian";
import { DiscourseNode } from "~/types";
import type DiscourseGraphPlugin from "~/index";
import { CreateNodeModal } from "~/components/CreateNodeModal";
import { createDiscourseNodeFile, formatNodeName } from "./createNode";
import { getNodeTagColors } from "./colorUtils";

const HOVER_DELAY = 200;
const HIDE_DELAY = 100;
const OBSERVER_RESTART_DELAY = 100;
const TOOLTIP_OFFSET = 40;

const sanitizeTitle = (title: string): string => {
  const invalidChars = /[\\/:]/g;

  // Remove list item indicators (numbered, bulleted, etc.)
  const listIndicator = /^(\s*)(\d+\.\s+|-\s+|\*\s+|\+\s+)/;

  return title
    .replace(listIndicator, "")
    .replace(invalidChars, "")
    .replace(/\s+/g, " ")
    .trim();
};

type ExtractedTagData = {
  fullLineContent: string;
  tagName: string;
};

type NodeCreationParams = {
  nodeType: DiscourseNode;
  title: string;
  editor: Editor;
  tagElement: HTMLElement;
};

/**
 * Handles discourse node tag interactions in Obsidian editor
 * - Observes DOM for discourse node tags
 * - Applies styling and hover functionality
 * - Creates discourse nodes from tag clicks
 */
export class TagNodeHandler {
  private plugin: DiscourseGraphPlugin;
  private app: App;
  private registeredEventHandlers: (() => void)[] = [];
  private tagObserver: MutationObserver | null = null;
  private currentTooltip: HTMLElement | null = null;

  constructor(plugin: DiscourseGraphPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Initialize the tag node handler
   */
  public initialize(): void {
    // Clean up any existing tooltips from previous instances
    this.cleanupTooltips();

    this.tagObserver = this.createTagObserver();
    this.startObserving();
    this.processTagsInView();
    this.setupEventHandlers();
  }

  /**
   * Refresh discourse tag colors when node types change
   */
  public refreshColors(): void {
    this.processTagsInView();
  }

  /**
   * Cleanup event handlers and tooltips
   */
  public cleanup(): void {
    this.cleanupEventHandlers();
    this.cleanupObserver();
    this.cleanupTooltips();
    this.cleanupProcessedTags();
  }

  // ============================================================================
  // DOM OBSERVATION & PROCESSING
  // ============================================================================

  /**
   * Create a MutationObserver to watch for discourse node tags
   */
  private createTagObserver(): MutationObserver {
    return new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Only process nodes that are likely to contain tags
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (
              node instanceof HTMLElement &&
              this.isTagRelevantElement(node)
            ) {
              this.processElement(node);
            }
          });
        }

        // Only watch class changes on elements that might be tags
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class" &&
          mutation.target instanceof HTMLElement
        ) {
          const target = mutation.target;
          if (hasTagClass(target)) {
            this.processElement(target);
          }
        }
      });
    });
  }

  /**
   * Check if element is relevant for tag processing
   */
  private isTagRelevantElement(element: HTMLElement): boolean {
    if (
      element.classList.contains("discourse-tag-popover") ||
      element.closest(".discourse-tag-popover") === element
    ) {
      return false;
    }

    return (
      element.classList.contains("cm-line") ||
      element.querySelector('[class*="cm-tag-"]') !== null ||
      hasTagClass(element)
    );
  }

  /**
   * Process an element and its children for discourse node tags
   */
  private processElement(element: HTMLElement): void {
    if (!document.contains(element)) {
      return;
    }

    this.plugin.settings.nodeTypes.forEach((nodeType) => {
      if (!nodeType.tag) {
        return;
      }

      const tag = nodeType.tag as string;
      const tagSelector = `.cm-tag-${tag}`;

      if (element.matches(tagSelector)) {
        this.applyDiscourseTagStyling(element, nodeType);
      }

      const childTags = element.querySelectorAll(tagSelector);
      childTags.forEach((tagEl) => {
        if (tagEl instanceof HTMLElement) {
          // Skip if this tag is already being processed or is inside a tooltip
          if (
            tagEl.dataset.discourseTagProcessed === "true" ||
            tagEl.closest(".discourse-tag-popover") === tagEl ||
            !document.contains(tagEl)
          ) {
            return;
          }
          this.applyDiscourseTagStyling(tagEl, nodeType);
        }
      });
    });
  }

  /**
   * Process existing tags in the current view (for initial setup)
   */
  private processTagsInView(): void {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;
    this.processElement(activeView.contentEl);
  }

  // ============================================================================
  // TAG STYLING & INTERACTION
  // ============================================================================

  /**
   * Apply colors and hover functionality to a discourse tag
   */
  private applyDiscourseTagStyling(
    tagElement: HTMLElement,
    nodeType: DiscourseNode,
  ): void {
    const alreadyProcessed =
      tagElement.dataset.discourseTagProcessed === "true";

    const nodeIndex = this.plugin.settings.nodeTypes.findIndex(
      (nt) => nt.id === nodeType.id,
    );
    const colors = getNodeTagColors(nodeType, nodeIndex);

    tagElement.style.backgroundColor = colors.backgroundColor;
    tagElement.style.color = colors.textColor;
    tagElement.style.cursor = "pointer";

    if (!alreadyProcessed) {
      const editor = this.getActiveEditor();
      if (editor) {
        this.addHoverFunctionality(tagElement, nodeType, editor);
      }
    }
  }
  // ============================================================================
  // CONTENT EXTRACTION & NODE CREATION
  // ============================================================================

  /**
   * Extract content from the entire line containing the clicked tag
   */
  private extractContent(tagElement: HTMLElement): ExtractedTagData | null {
    const lineDiv = tagElement.closest(".cm-line");
    if (!lineDiv) return null;

    const fullLineText = lineDiv.textContent || "";

    const tagClasses = Array.from(tagElement.classList);
    const tagClass = tagClasses.find((cls) => cls.startsWith("cm-tag-"));
    if (!tagClass) return null;

    const tagName = tagClass.replace("cm-tag-", "");

    return {
      fullLineContent: fullLineText.trim(),
      tagName,
    };
  }

  /**
   * Handle tag click to create discourse node
   */
  private handleTagClick(
    tagElement: HTMLElement,
    nodeType: DiscourseNode,
    editor: Editor,
  ): void {
    const extractedData = this.extractContent(tagElement);
    if (!extractedData) {
      new Notice("Could not create discourse node", 3000);
      return;
    }

    const cleanText = sanitizeTitle(
      extractedData.fullLineContent.replace(/#[^\s]+/g, ""),
    );

    new CreateNodeModal(this.app, {
      nodeTypes: this.plugin.settings.nodeTypes,
      plugin: this.plugin,
      initialTitle: cleanText,
      initialNodeType: nodeType,
      onNodeCreate: async (selectedNodeType, title) => {
        await this.createNodeAndReplace({
          nodeType: selectedNodeType,
          title,
          editor,
          tagElement,
        });
      },
    }).open();
  }

  /**
   * Create the discourse node and replace the content up to the tag
   */
  private async createNodeAndReplace(
    params: NodeCreationParams,
  ): Promise<void> {
    const { nodeType, title, editor, tagElement } = params;
    try {
      // Create the discourse node file
      const formattedNodeName = formatNodeName(title, nodeType);
      if (!formattedNodeName) {
        new Notice("Failed to format node name", 3000);
        return;
      }

      const newFile = await createDiscourseNodeFile({
        plugin: this.plugin,
        formattedNodeName,
        nodeType,
      });

      if (!newFile) {
        new Notice("Failed to create discourse node file", 3000);
        return;
      }

      const extractedData = this.extractContent(tagElement);
      if (!extractedData) {
        new Notice("Could not create discourse node", 3000);
        return;
      }

      const { fullLineContent } = extractedData;
      // Find the actual line in editor that matches our DOM content
      const allLines = editor.getValue().split("\n");
      let lineNumber = -1;
      for (let i = 0; i < allLines.length; i++) {
        if (
          allLines[i]?.includes(fullLineContent) &&
          allLines[i]?.includes(tagElement.textContent ?? "")
        ) {
          lineNumber = i;
          break;
        }
      }

      if (lineNumber === -1) {
        new Notice("Could not replace tag with discourse node", 3000);
        return;
      }

      const actualLineText = allLines[lineNumber];
      if (!actualLineText) {
        new Notice("Could not replace tag with discourse node", 3000);
        return;
      }

      const linkText = `[[${formattedNodeName}]]`;

      // Replace the entire line with just the discourse node link
      editor.replaceRange(
        linkText,
        { line: lineNumber, ch: 0 },
        { line: lineNumber, ch: actualLineText.length },
      );

      this.cleanupProcessedTags();
      this.cleanupTooltips();
    } catch (error) {
      console.error("Error creating discourse node from tag:", error);
      new Notice(
        `Error creating discourse node: ${error instanceof Error ? error.message : String(error)}`,
        5000,
      );
    }
  }

  // ============================================================================
  // HOVER FUNCTIONALITY & TOOLTIPS
  // ============================================================================

  /**
   * Add hover functionality with "Create [NodeType]" button
   */
  private addHoverFunctionality(
    tagElement: HTMLElement,
    nodeType: DiscourseNode,
    editor: Editor,
  ): void {
    if (tagElement.dataset.discourseTagProcessed === "true") return;
    tagElement.dataset.discourseTagProcessed = "true";

    if (
      (tagElement as HTMLElement & { __discourseTagCleanup?: () => void })
        .__discourseTagCleanup
    ) {
      return;
    }

    let hoverTimeout: number | null = null;

    const showTooltip = () => {
      if (this.currentTooltip) return;

      const rect = tagElement.getBoundingClientRect();

      this.currentTooltip = document.createElement("div");
      this.currentTooltip.className = "discourse-tag-popover";
      this.currentTooltip.style.cssText = `
        position: fixed;
        top: ${rect.top - TOOLTIP_OFFSET}px;
        left: ${rect.left + rect.width / 2}px;
        transform: translateX(-50%);
        border-radius: 6px;
        padding: 6px;
        z-index: 9999;
        white-space: nowrap;
        font-size: 12px;
        pointer-events: auto;
      `;

      const createButton = document.createElement("button");
      createButton.textContent = `Create ${nodeType.name}`;
      createButton.className = "mod-cta dg-create-node-button";

      createButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        this.handleTagClick(tagElement, nodeType, editor);

        hideTooltip();
      });

      this.currentTooltip.appendChild(createButton);

      document.body.appendChild(this.currentTooltip);

      this.currentTooltip.addEventListener("mouseenter", () => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
      });

      this.currentTooltip.addEventListener("mouseleave", () => {
        void setTimeout(hideTooltip, HIDE_DELAY);
      });
    };

    const hideTooltip = () => {
      if (this.currentTooltip) {
        this.currentTooltip.remove();
        this.currentTooltip = null;
      }
    };

    tagElement.addEventListener("mouseenter", () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      hoverTimeout = window.setTimeout(showTooltip, HOVER_DELAY);
    });

    tagElement.addEventListener("mouseleave", (e) => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }

      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!relatedTarget || !this.currentTooltip?.contains(relatedTarget)) {
        void setTimeout(hideTooltip, HIDE_DELAY);
      }
    });

    const cleanup = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      hideTooltip();
    };

    (
      tagElement as HTMLElement & { __discourseTagCleanup?: () => void }
    ).__discourseTagCleanup = cleanup;
  }

  // ============================================================================
  // OBSERVER MANAGEMENT
  // ============================================================================

  /**
   * Start observing the current active view for tag changes
   */
  private startObserving(): void {
    if (!this.tagObserver) return;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const targetElement = activeView.contentEl;
    if (targetElement) {
      this.tagObserver.observe(targetElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class"],
      });
    }
  }

  /**
   * Stop observing
   */
  private stopObserving(): void {
    if (this.tagObserver) {
      this.tagObserver.disconnect();
    }
  }

  // ============================================================================
  // EVENT HANDLERS & LIFECYCLE
  // ============================================================================

  /**
   * Setup workspace event handlers
   */
  private setupEventHandlers(): void {
    const activeLeafChangeHandler = () => {
      void setTimeout(() => {
        this.stopObserving();
        this.startObserving();
        this.processTagsInView();
      }, OBSERVER_RESTART_DELAY);
    };

    this.app.workspace.on("active-leaf-change", activeLeafChangeHandler);
    this.registeredEventHandlers.push(() => {
      this.app.workspace.off("active-leaf-change", activeLeafChangeHandler);
    });
  }

  /**
   * Cleanup event handlers
   */
  private cleanupEventHandlers(): void {
    this.registeredEventHandlers.forEach((cleanup) => cleanup());
    this.registeredEventHandlers = [];
  }

  /**
   * Cleanup observer
   */
  private cleanupObserver(): void {
    this.stopObserving();
    this.tagObserver = null;
  }

  /**
   * Cleanup tooltips
   */
  private cleanupTooltips(): void {
    if (this.currentTooltip) {
      this.currentTooltip.remove();
      this.currentTooltip = null;
    }
    const tooltips = document.querySelectorAll(".discourse-tag-popover");
    tooltips.forEach((tooltip) => tooltip.remove());
  }

  /**
   * Cleanup processed tags
   */
  private cleanupProcessedTags(): void {
    const processedTags = document.querySelectorAll(
      '[data-discourse-tag-processed="true"]',
    );
    processedTags.forEach((tag) => {
      const tagWithCleanup = tag as HTMLElement & {
        __discourseTagCleanup?: () => void;
      };
      const cleanup = tagWithCleanup.__discourseTagCleanup;
      if (typeof cleanup === "function") {
        cleanup();
      }
      tag.removeAttribute("data-discourse-tag-processed");

      // Reset styles for the tag element
      const htmlTag = tag as HTMLElement;
      htmlTag.style.backgroundColor = "";
      htmlTag.style.color = "";
      htmlTag.style.cursor = "";
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get the active editor (helper method)
   */
  private getActiveEditor(): Editor | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    return activeView?.editor || null;
  }
}

/**
 * Check if element has cm-tag-* class
 */
export const hasTagClass = (element: HTMLElement): boolean => {
  return Array.from(element.classList).some((cls) => cls.startsWith("cm-tag-"));
};
