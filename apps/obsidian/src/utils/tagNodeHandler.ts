import { App, Editor, Notice, MarkdownView } from "obsidian";
import { DiscourseNode } from "~/types";
import type DiscourseGraphPlugin from "~/index";
import { CreateNodeModal } from "~/components/CreateNodeModal";
import { createDiscourseNodeFile, formatNodeName } from "./createNode";
import { getDiscourseNodeColors } from "./colorUtils";

export class TagNodeHandler {
  private plugin: DiscourseGraphPlugin;
  private app: App;
  private registeredEventHandlers: (() => void)[] = [];
  private tagObserver: MutationObserver | null = null;

  constructor(plugin: DiscourseGraphPlugin) {
    this.plugin = plugin;
    this.app = plugin.app;
  }

  /**
   * Create a MutationObserver to watch for discourse node tags
   */
  private createTagObserver(): MutationObserver {
    return new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Only process nodes that are likely to contain tags
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (node.classList.contains('cm-line') || 
                  node.querySelector('[class*="cm-tag-"]') ||
                  Array.from(node.classList).some(cls => cls.startsWith('cm-tag-'))) {
                this.processElement(node);
              }
            }
          });
        }
        
        // Only watch class changes on elements that might be tags
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'class' && 
            mutation.target instanceof HTMLElement) {
          const target = mutation.target;
          const classList = Array.from(target.classList);
          
          // Only process if it has or gained a cm-tag-* class
          if (classList.some(cls => cls.startsWith('cm-tag-'))) {
            this.processElement(target);
          }
        }
      });
    });
  }

  /**
   * Process an element and its children for discourse node tags
   */
  private processElement(element: HTMLElement) {
    this.plugin.settings.nodeTypes.forEach((nodeType) => {
      const nodeTypeName = nodeType.name.toLowerCase();
      const tagSelector = `.cm-tag-${nodeTypeName}`;
      
      // Check if the element itself matches
      if (element.matches(tagSelector)) {
        this.applyDiscourseTagStyling(element, nodeType);
      }
      
      // Check all children
      const childTags = element.querySelectorAll(tagSelector);
      childTags.forEach((tagEl) => {
        if (tagEl instanceof HTMLElement) {
          this.applyDiscourseTagStyling(tagEl, nodeType);
        }
      });
    });
  }

  /**
   * Apply colors and hover functionality to a discourse tag
   */
  private applyDiscourseTagStyling(tagElement: HTMLElement, nodeType: DiscourseNode) {
    const alreadyProcessed = tagElement.dataset.discourseTagProcessed === 'true';

    const nodeIndex = this.plugin.settings.nodeTypes.findIndex((nt) => nt.id === nodeType.id);
    const colors = getDiscourseNodeColors(nodeType, nodeIndex);

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

  /**
   * Get the active editor (helper method)
   */
  private getActiveEditor(): Editor | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    return activeView?.editor || null;
  }
  /**
   * Extract content from the line up to the clicked tag using simple text approach
   */
  private extractContentUpToTag(tagElement: HTMLElement): { contentUpToTag: string; tagName: string } | null {
    const lineDiv = tagElement.closest('.cm-line');
    if (!lineDiv) return null;
    
    const fullLineText = lineDiv.textContent || '';
    
    const tagClasses = Array.from(tagElement.classList);
    const tagClass = tagClasses.find(cls => cls.startsWith('cm-tag-'));
    if (!tagClass) return null;
    
    const tagName = tagClass.replace('cm-tag-', '');
    const tagWithHash = `#${tagName}`;
    
    const tagIndex = fullLineText.indexOf(tagWithHash);
    if (tagIndex === -1) return null;
    
    const contentUpToTag = fullLineText.substring(0, tagIndex).trim();

    return {
      contentUpToTag,
      tagName
    };
  }



  /**
   * Handle tag click to create discourse node
   */
  private handleTagClick(tagElement: HTMLElement, nodeType: DiscourseNode, editor: Editor): void {
    const extractedData = this.extractContentUpToTag(tagElement);
    if (!extractedData) {
      new Notice("Could not extract content", 3000);
      return;
    }

    const cleanText = extractedData.contentUpToTag.replace(/#\w+/g, '').trim();
    
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
  private async createNodeAndReplace(params: {
    nodeType: DiscourseNode;
    title: string;
    editor: Editor;
    tagElement: HTMLElement;
  }): Promise<void> {
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

      const extractedData = this.extractContentUpToTag(tagElement);
      if (!extractedData) {
        new Notice("Could not determine content range for replacement", 3000);
        return;
      }
      
      const { contentUpToTag, tagName } = extractedData;
      const tagWithHash = `#${tagName}`;
      
      // Find the actual line in editor that matches our DOM content
      const allLines = editor.getValue().split('\n');
      let lineNumber = -1;
      for (let i = 0; i < allLines.length; i++) {
        if (allLines[i]?.includes(tagWithHash) && allLines[i]?.includes(contentUpToTag.substring(0, 10))) {
          lineNumber = i;
          break;
        }
      }
      
      if (lineNumber === -1) {
        new Notice("Could not find matching line in editor", 3000);
        return;
      }
      
      const actualLineText = allLines[lineNumber]; 
      if (!actualLineText) {
        new Notice("Could not find matching line in editor", 3000);
        return;
      }
      const tagStartPos = actualLineText.indexOf(tagWithHash);
      const tagEndPos = tagStartPos + tagWithHash.length;
      
      const linkText = `[[${formattedNodeName}]]`;
      const contentAfterTag = actualLineText.substring(tagEndPos);
      
      editor.replaceRange(
        linkText + contentAfterTag,
        { line: lineNumber, ch: 0 },
        { line: lineNumber, ch: actualLineText.length }
      );
    } catch (error) {
      console.error("Error creating discourse node from tag:", error);
      new Notice(
        `Error creating discourse node: ${error instanceof Error ? error.message : String(error)}`,
        5000,
      );
    }
  }

  /**
   * Add hover functionality with "Create [NodeType]" button
   */
  private addHoverFunctionality(tagElement: HTMLElement, nodeType: DiscourseNode, editor: Editor) {
    // Mark as processed to avoid duplicate handlers
    if (tagElement.dataset.discourseTagProcessed === 'true') return;
    tagElement.dataset.discourseTagProcessed = 'true';
    
    let hoverTooltip: HTMLElement | null = null;
    let hoverTimeout: number | null = null;
    
    const showTooltip = () => {
      if (hoverTooltip) return;
      const rect = tagElement.getBoundingClientRect();
      
      hoverTooltip = document.createElement('div');
      hoverTooltip.className = 'discourse-tag-popover';
      hoverTooltip.style.cssText = `
        position: fixed;
        top: ${rect.top - 40}px;
        left: ${rect.left + rect.width / 2}px;
        transform: translateX(-50%);
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        padding: 6px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        z-index: 9999;
        white-space: nowrap;
        font-size: 12px;
        pointer-events: auto;
      `;
      
      const createButton = document.createElement('button');
      createButton.textContent = `Create ${nodeType.name}`;
      createButton.className = 'mod-cta dg-create-node-button';
      
      createButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        this.handleTagClick(tagElement, nodeType, editor);
        
        hideTooltip();
      });
      
      hoverTooltip.appendChild(createButton);
      
      document.body.appendChild(hoverTooltip);
      
      hoverTooltip.addEventListener('mouseenter', () => {
        if (hoverTimeout) {
          clearTimeout(hoverTimeout);
          hoverTimeout = null;
        }
      });
      
      hoverTooltip.addEventListener('mouseleave', () => {
        void setTimeout(hideTooltip, 100);
      });
    };
    
    const hideTooltip = () => {
      if (hoverTooltip) {
        hoverTooltip.remove();
        hoverTooltip = null;
      }
    };
    
    tagElement.addEventListener('mouseenter', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      hoverTimeout = window.setTimeout(showTooltip, 200);
    });
    
    tagElement.addEventListener('mouseleave', (e) => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (!relatedTarget || !hoverTooltip?.contains(relatedTarget)) {
        void setTimeout(hideTooltip, 100);
      }
    });
    
    const cleanup = () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
      hideTooltip();
    };
    
    (tagElement as HTMLElement & { __discourseTagCleanup?: () => void }).__discourseTagCleanup = cleanup;
  }
  
  

  /**
   * Process existing tags in the current view (for initial setup)
   */
  private processTagsInView() {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    this.processElement(activeView.contentEl);
  }

  /**
   * Refresh discourse tag colors when node types change
   */
  public refreshColors() {
    this.processTagsInView();
  }

  /**
   * Initialize the tag node handler
   */
  public initialize() {
    // Create and start the tag observer (similar to Roam's approach)
    this.tagObserver = this.createTagObserver();
    
    // Start observing the workspace
    this.startObserving();
    
    // Process existing tags in the current view
    this.processTagsInView();
    
    // Re-start observing when the active view changes
    const activeLeafChangeHandler = () => {
      void setTimeout(() => {
        this.stopObserving();
        this.startObserving();
        this.processTagsInView();
      }, 100);
    };
    
    this.app.workspace.on('active-leaf-change', activeLeafChangeHandler);
    this.registeredEventHandlers.push(() => {
      this.app.workspace.off('active-leaf-change', activeLeafChangeHandler);
    });
  }

  /**
   * Start observing the current active view for tag changes
   */
  private startObserving() {
    if (!this.tagObserver) return;
    
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;
    
    const targetElement = activeView.contentEl;
    if (targetElement) {
      this.tagObserver.observe(targetElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }

  /**
   * Stop observing
   */
  private stopObserving() {
    if (this.tagObserver) {
      this.tagObserver.disconnect();
    }
  }

  /**
   * Cleanup event handlers and tooltips
   */
  public cleanup() {
    this.registeredEventHandlers.forEach(cleanup => cleanup());
    this.registeredEventHandlers = [];
    
    // Stop and cleanup the tag observer
    this.stopObserving();
    this.tagObserver = null;
    
    // Clean up any remaining tooltips
    const tooltips = document.querySelectorAll('.discourse-tag-popover');
    tooltips.forEach(tooltip => tooltip.remove());
    
    // Clean up processed tags
    const processedTags = document.querySelectorAll('[data-discourse-tag-processed="true"]');
    processedTags.forEach(tag => {
      const tagWithCleanup = tag as HTMLElement & { __discourseTagCleanup?: () => void };
      const cleanup = tagWithCleanup.__discourseTagCleanup;
      if (typeof cleanup === 'function') {
        cleanup();
      }
      tag.removeAttribute('data-discourse-tag-processed');
      
      // Reset styles for the tag element
      const htmlTag = tag as HTMLElement;
      htmlTag.style.backgroundColor = '';
      htmlTag.style.color = '';
      htmlTag.style.cursor = '';
    });
  }
}
