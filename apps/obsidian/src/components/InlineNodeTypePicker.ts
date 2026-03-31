import { Editor } from "obsidian";
import { DiscourseNode } from "~/types";
import { createDiscourseNode } from "~/utils/createNode";
import type DiscourseGraphPlugin from "~/index";

/**
 * A popover that shows all node types inline near the cursor/selection.
 * When the user picks a node type, the selected text is transformed into
 * a discourse node and the selection is replaced with a [[link]].
 */
export class InlineNodeTypePicker {
  private popover: HTMLElement | null = null;
  private items: DiscourseNode[] = [];
  private selectedIndex = 0;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    private options: {
      editor: Editor;
      nodeTypes: DiscourseNode[];
      plugin: DiscourseGraphPlugin;
      selectedText: string;
    },
  ) {
    this.items = this.options.nodeTypes.filter((nt) => nt.name);
  }

  private getCursorPosition(): { x: number; y: number } | null {
    try {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      if (rect.width === 0 && rect.height === 0) {
        const span = document.createElement("span");
        span.textContent = "\u200B";
        range.insertNode(span);
        const spanRect = span.getBoundingClientRect();
        span.remove();

        if (spanRect.width === 0 && spanRect.height === 0) return null;

        return { x: spanRect.left, y: spanRect.bottom };
      }

      return { x: rect.left, y: rect.bottom };
    } catch {
      return null;
    }
  }

  private createPopover(): HTMLElement {
    const popover = document.createElement("div");
    popover.className =
      "inline-node-type-picker fixed z-[10000] bg-primary border border-modifier-border rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.15)] max-h-[300px] overflow-y-auto min-w-[200px] max-w-[400px]";
    const itemsContainer = document.createElement("div");
    itemsContainer.className = "inline-node-type-items-container";
    popover.appendChild(itemsContainer);

    this.renderItems(itemsContainer);

    return popover;
  }

  private renderItems(container: HTMLElement) {
    container.innerHTML = "";

    if (this.items.length === 0) {
      const noResults = document.createElement("div");
      noResults.className = "p-3 text-center text-muted text-sm";
      noResults.textContent = "No node types available";
      container.appendChild(noResults);
      return;
    }

    this.items.forEach((item, index) => {
      const itemEl = document.createElement("div");
      itemEl.className = `inline-node-type-item px-3 py-2 cursor-pointer flex items-center gap-2 border-b border-[var(--background-modifier-border-hover)]${
        index === this.selectedIndex ? " bg-modifier-hover" : ""
      }`;
      itemEl.dataset.index = index.toString();

      if (item.color) {
        const colorDot = document.createElement("div");
        colorDot.className = "w-3 h-3 rounded-full shrink-0";
        colorDot.style.backgroundColor = item.color;
        itemEl.appendChild(colorDot);
      }

      const nameText = document.createElement("div");
      nameText.textContent = item.name;
      nameText.className = "font-medium text-normal text-sm";
      itemEl.appendChild(nameText);

      itemEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        void this.selectItem(item);
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
      `.inline-node-type-item[data-index="${this.selectedIndex}"]`,
    ) as HTMLElement;
    if (prevSelected) {
      prevSelected.classList.remove("bg-modifier-hover");
    }

    this.selectedIndex = newIndex;

    const newSelected = this.popover?.querySelector(
      `.inline-node-type-item[data-index="${this.selectedIndex}"]`,
    ) as HTMLElement;
    if (newSelected) {
      newSelected.classList.add("bg-modifier-hover");
    }
  }

  private scrollToSelected() {
    const selectedEl = this.popover?.querySelector(
      `.inline-node-type-item[data-index="${this.selectedIndex}"]`,
    ) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  private async selectItem(item: DiscourseNode) {
    this.close();
    await createDiscourseNode({
      plugin: this.options.plugin,
      nodeType: item,
      text: this.options.selectedText,
      editor: this.options.editor,
    });
  }

  private setupEventHandlers() {
    this.keydownHandler = (e: KeyboardEvent) => {
      if (!this.popover) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (this.items.length === 0) return;
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
          void this.selectItem(selectedItem);
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
        !(e.target as HTMLElement).closest(".inline-node-type-picker")
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
    if (!position) return;

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
