/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/naming-convention */
import { App, Editor, Notice, MarkdownView, TFile } from "obsidian";
import { DiscourseNode } from "~/types";
import type DiscourseGraphPlugin from "~/index";
import ModifyNodeModal from "~/components/ModifyNodeModal";
import { createDiscourseNodeFile, formatNodeName } from "./createNode";
import { getNodeTagColors } from "./colorUtils";
import { addRelationToFrontmatter } from "~/components/canvas/utils/frontmatterUtils";

const HOVER_DELAY = 200;
const HIDE_DELAY = 100;
const OBSERVER_RESTART_DELAY = 100;
const TOOLTIP_OFFSET = 40;

const LIST_INDICATOR_REGEX = /^(\s*)(\d+[.)]\s+|[-*+]\s+(?:\[[ xX]\]\s+)?)/;

const sanitizeTitle = (title: string): string => {
  const invalidChars = /[\\/:]/g;

  return title
    .replace(LIST_INDICATOR_REGEX, "")
    .replace(invalidChars, "")
    .replace(/\s+/g, " ")
    .trim();
};

const extractListPrefix = (line: string): string => {
  const match = line.match(LIST_INDICATOR_REGEX);
  return match ? match[0] : "";
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
  selectedExistingNode?: TFile;
  relationshipTypeId?: string;
  relationshipTargetFile?: TFile;
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

    // Get the current file from the active view
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const currentFile = activeView?.file || undefined;

    new ModifyNodeModal(this.app, {
      nodeTypes: this.plugin.settings.nodeTypes,
      plugin: this.plugin,
      initialTitle: cleanText,
      initialNodeType: nodeType,
      currentFile,
      onSubmit: async ({
        nodeType: selectedNodeType,
        title,
        selectedExistingNode,
        relationshipTypeId,
        relationshipTargetFile,
      }) => {
        await this.createNodeAndReplace({
          nodeType: selectedNodeType,
          title,
          editor,
          tagElement,
          selectedExistingNode,
          relationshipTypeId,
          relationshipTargetFile,
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
    const {
      nodeType,
      title,
      editor,
      tagElement,
      selectedExistingNode,
      relationshipTypeId,
      relationshipTargetFile,
    } = params;
    try {
      let linkText: string;
      let createdOrSelectedFile: TFile;

      if (selectedExistingNode) {
        linkText = `[[${selectedExistingNode.basename}]]`;
        createdOrSelectedFile = selectedExistingNode;
      } else {
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

        linkText = `[[${formattedNodeName}]]`;
        createdOrSelectedFile = newFile;
      }

      // Add relationship to frontmatter if specified
      if (relationshipTypeId && relationshipTargetFile) {
        await addRelationToFrontmatter({
          app: this.app,
          plugin: this.plugin,
          sourceFile: createdOrSelectedFile,
          targetFile: relationshipTargetFile,
          relationTypeId: relationshipTypeId,
        });
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

      const listPrefix = extractListPrefix(actualLineText);
      const replacementText = listPrefix + linkText;

      editor.replaceRange(
        replacementText,
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
    let currentMouseY = 0;
    let currentMouseX = 0;

    // Track mouse position to determine which part of multi-line tag is hovered
    const handleMouseMove = (e: MouseEvent) => {
      currentMouseY = e.clientY;
      currentMouseX = e.clientX;

      // Update tooltip position if it's already visible
      if (this.currentTooltip) {
        updateTooltipPosition();
      }
    };

    const getClosestRect = (): DOMRect => {
      const range = document.createRange();
      range.selectNodeContents(tagElement);
      const clientRects = range.getClientRects();

      if (clientRects.length > 0) {
        // If tag spans multiple lines, find the rect closest to mouse position
        if (clientRects.length > 1) {
          let closestRect: DOMRect | null = null;
          let minDistance = Infinity;

          for (let i = 0; i < clientRects.length; i++) {
            const r = clientRects.item(i);
            if (!r) continue;

            // Calculate distance from mouse position to center of this rect
            const rectCenterY = r.top + r.height / 2;
            const rectCenterX = r.left + r.width / 2;
            const distanceY = Math.abs(currentMouseY - rectCenterY);
            const distanceX = Math.abs(currentMouseX - rectCenterX);
            // Weight Y distance more heavily since we care more about vertical proximity
            const distance = distanceY * 2 + distanceX;

            if (distance < minDistance) {
              minDistance = distance;
              closestRect = r;
            }
          }

          return (
            closestRect ||
            clientRects.item(clientRects.length - 1) ||
            tagElement.getBoundingClientRect()
          );
        } else {
          // Single line tag - use the only rect
          return clientRects.item(0) || tagElement.getBoundingClientRect();
        }
      }

      return tagElement.getBoundingClientRect();
    };

    const updateTooltipPosition = () => {
      if (!this.currentTooltip) return;

      const rect = getClosestRect();
      this.currentTooltip.style.top = `${rect.top - TOOLTIP_OFFSET}px`;
      this.currentTooltip.style.left = `${rect.left + rect.width / 2}px`;
    };

    const showTooltip = () => {
      if (this.currentTooltip) return;

      const rect = getClosestRect();

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

    tagElement.addEventListener("mousemove", handleMouseMove);

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
      tagElement.removeEventListener("mousemove", handleMouseMove);
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
