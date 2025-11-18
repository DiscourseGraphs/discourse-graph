import { Editor } from "obsidian";
import { DiscourseNode } from "~/types";

type NodeTagItem = {
  nodeType: DiscourseNode;
  tag: string;
};

export class NodeTagSuggestPopover {
  private popover: HTMLElement | null = null;
  private items: NodeTagItem[] = [];
  private selectedIndex = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    private editor: Editor,
    private nodeTypes: DiscourseNode[],
  ) {
    this.initializeItems();
  }

  private initializeItems() {
    this.items = [];
    this.nodeTypes.forEach((nodeType) => {
      if (nodeType.tag) {
        this.items.push({
          nodeType,
          tag: nodeType.tag,
        });
      }
    });
  }

  private getCursorPosition(): { x: number; y: number } | null {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        console.error("No selection found");
        return null;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // If the rect has no dimensions (collapsed cursor), try using a temporary span to get cursor position
      if (rect.width === 0 && rect.height === 0) {
        const span = document.createElement("span");
        span.textContent = "\u200B";
        range.insertNode(span);
        const spanRect = span.getBoundingClientRect();
        span.remove();

        if (spanRect.width === 0 && spanRect.height === 0) {
          console.error("Could not determine cursor position");
          return null;
        }

        return {
          x: spanRect.left,
          y: spanRect.bottom,
        };
      }

      return {
        x: rect.left,
        y: rect.bottom,
      };
    } catch (error) {
      console.error("Error getting cursor position:", error);
      return null;
    }
  }

  private createPopover(): HTMLElement {
    const popover = document.createElement("div");
    popover.className = "node-tag-suggest-popover";
    popover.style.cssText = `
      position: fixed;
      z-index: 10000;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      max-height: 300px;
      overflow-y: auto;
      min-width: 200px;
      max-width: 400px;
    `;

    const itemsContainer = document.createElement("div");
    itemsContainer.className = "node-tag-items-container";
    popover.appendChild(itemsContainer);

    this.renderItems(itemsContainer);

    return popover;
  }

  private renderItems(container: HTMLElement) {
    container.innerHTML = "";

    if (this.items.length === 0) {
      const noResults = document.createElement("div");
      noResults.style.cssText = `
        padding: 12px;
        text-align: center;
        color: var(--text-muted);
        font-size: 14px;
      `;
      noResults.textContent = "No node tags available";
      container.appendChild(noResults);
      return;
    }

    this.items.forEach((item, index) => {
      const itemEl = document.createElement("div");
      itemEl.className = "node-tag-item";
      itemEl.dataset.index = index.toString();
      itemEl.style.cssText = `
        padding: 8px 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid var(--background-modifier-border-hover);
      `;

      if (index === this.selectedIndex) {
        itemEl.style.backgroundColor = "var(--background-modifier-hover)";
      }

      if (item.nodeType.color) {
        const colorDot = document.createElement("div");
        colorDot.style.cssText = `
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background-color: ${item.nodeType.color};
          flex-shrink: 0;
        `;
        itemEl.appendChild(colorDot);
      }

      const textContainer = document.createElement("div");
      textContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
      `;

      const tagText = document.createElement("div");
      tagText.textContent = `#${item.tag}`;
      tagText.style.cssText = `
        font-weight: 500;
        color: var(--text-normal);
        font-size: 14px;
      `;

      const nodeTypeText = document.createElement("div");
      nodeTypeText.textContent = item.nodeType.name;
      nodeTypeText.style.cssText = `
        font-size: 12px;
        color: var(--text-muted);
      `;

      textContainer.appendChild(tagText);
      textContainer.appendChild(nodeTypeText);
      itemEl.appendChild(textContainer);

      itemEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.selectItem(item);
      });

      itemEl.addEventListener("mouseenter", () => {
        this.updateSelectedIndex(index);
      });

      container.appendChild(itemEl);
    });
  }

  private updateSelectedIndex(newIndex: number) {
    if (newIndex === this.selectedIndex) return;

    const prevSelected = this.popover?.querySelector(
      `.node-tag-item[data-index="${this.selectedIndex}"]`,
    ) as HTMLElement;
    if (prevSelected) {
      prevSelected.style.backgroundColor = "";
    }

    this.selectedIndex = newIndex;

    const newSelected = this.popover?.querySelector(
      `.node-tag-item[data-index="${this.selectedIndex}"]`,
    ) as HTMLElement;
    if (newSelected) {
      newSelected.style.backgroundColor = "var(--background-modifier-hover)";
    }
  }

  private scrollToSelected() {
    const selectedEl = this.popover?.querySelector(
      `.node-tag-item[data-index="${this.selectedIndex}"]`,
    ) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  private selectItem(item: NodeTagItem) {
    const tagText = `#${item.tag} `;
    const cursor = this.editor.getCursor();
    this.editor.replaceRange(tagText, cursor, cursor);
    const newCursor = {
      line: cursor.line,
      ch: cursor.ch + tagText.length,
    };
    this.editor.setCursor(newCursor);
    this.close();
  }

  private setupEventHandlers() {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.popover) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const newIndex = Math.min(
          this.selectedIndex + 1,
          this.items.length - 1,
        );
        this.updateSelectedIndex(newIndex);
        this.scrollToSelected();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        const newIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelectedIndex(newIndex);
        this.scrollToSelected();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const selectedItem = this.items[this.selectedIndex];
        if (selectedItem) {
          this.selectItem(selectedItem);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      }
    };

    this.clickOutsideHandler = (e: MouseEvent) => {
      if (
        this.popover &&
        !this.popover.contains(e.target as Node) &&
        !(e.target as HTMLElement).closest(".node-tag-suggest-popover")
      ) {
        this.close();
      }
    };

    document.addEventListener("keydown", this.keydownHandler, true);
    document.addEventListener("mousedown", this.clickOutsideHandler, true);
  }

  private removeEventHandlers() {
    if (this.keydownHandler) {
      document.removeEventListener("keydown", this.keydownHandler, true);
      this.keydownHandler = null;
    }
    if (this.clickOutsideHandler) {
      document.removeEventListener("mousedown", this.clickOutsideHandler, true);
      this.clickOutsideHandler = null;
    }
  }

  public open() {
    if (this.popover) {
      this.close();
    }

    const position = this.getCursorPosition();
    if (!position) {
      console.error("Could not get cursor position for popover");
      return;
    }

    this.popover = this.createPopover();
    document.body.appendChild(this.popover);

    const popoverRect = this.popover.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = position.x;
    let top = position.y + 4;

    if (left + popoverRect.width > viewportWidth) {
      left = viewportWidth - popoverRect.width - 10;
    }
    if (left < 10) {
      left = 10;
    }

    if (top + popoverRect.height > viewportHeight) {
      // Position above cursor instead
      top = position.y - popoverRect.height - 4;
    }
    if (top < 10) {
      top = 10;
    }

    this.popover.style.left = `${left}px`;
    this.popover.style.top = `${top}px`;

    this.setupEventHandlers();
  }

  public close() {
    this.removeEventHandlers();
    if (this.popover) {
      this.popover.remove();
      this.popover = null;
    }
    this.selectedIndex = 0;
  }
}
