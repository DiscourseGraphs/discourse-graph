import { Fragment, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { editorInfoField, Scope } from "obsidian";
import type { EditorView } from "@codemirror/view";
import type DiscourseGraphPlugin from "~/index";
import { QueryEngine, type SearchableNode } from "~/services/QueryEngine";
import {
  groupNodesForSummonMenu,
  type SummonMenuGroup,
} from "~/utils/nodeSummonResults";

const VIEWPORT_MARGIN = 8;

type NodeSummonListProps = {
  groups: SummonMenuGroup[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
};

const NodeSummonList = ({
  groups,
  activeIndex,
  onSelect,
  onHover,
}: NodeSummonListProps) => {
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (groups.length === 0) {
    return <div className="suggestion-empty">No matching nodes</div>;
  }

  let index = 0;
  return (
    <div className="suggestion">
      {groups.map((group, groupIndex) => (
        <Fragment key={group.nodeType.id}>
          <div
            className={`flex items-center gap-2 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]${
              groupIndex > 0
                ? "mt-1 border-0 border-t border-solid border-[var(--background-modifier-border)]"
                : ""
            }`}
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-[var(--text-faint)]"
              style={
                group.nodeType.color
                  ? { backgroundColor: group.nodeType.color }
                  : undefined
              }
            />
            {group.nodeType.name}
          </div>
          {group.nodes.map((node) => {
            const itemIndex = index++;
            const isActive = itemIndex === activeIndex;
            return (
              <div
                key={node.file.path}
                ref={isActive ? activeRef : undefined}
                // Indented past the header's dot so rows read as children of the type.
                className={`suggestion-item pl-7${isActive ? "is-selected" : ""}`}
                // Keeps focus in the editor, so the cursor stays after the query.
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => onHover(itemIndex)}
                onClick={() => onSelect(itemIndex)}
              >
                {node.title}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
};

type NodeSummonMenuOptions = {
  plugin: DiscourseGraphPlugin;
  view: EditorView;
  triggerFrom: number;
  trigger: string;
};

class NodeSummonMenu {
  readonly view: EditorView;
  readonly trigger: string;
  triggerFrom: number;
  private plugin: DiscourseGraphPlugin;
  private nodes: SearchableNode[];
  private query = "";
  private activeIndex = 0;
  private groups: SummonMenuGroup[] = [];
  private containerEl: HTMLElement;
  private root: Root;
  private scope: Scope;
  private resizeObserver: ResizeObserver;
  private cleanupListeners: (() => void)[] = [];

  constructor({ plugin, view, triggerFrom, trigger }: NodeSummonMenuOptions) {
    this.plugin = plugin;
    this.view = view;
    this.triggerFrom = triggerFrom;
    this.trigger = trigger;
    // Loaded once per opening; typing only re-ranks.
    this.nodes = new QueryEngine(plugin.app).getSearchableNodes(
      plugin.settings.nodeTypes,
    );

    const doc = view.dom.ownerDocument;
    this.containerEl = doc.body.createDiv({
      cls: "suggestion-container dg-node-summon-menu",
    });
    // Mounted directly so .suggestion is the flex child that scrolls inside the capped container.
    this.root = createRoot(this.containerEl);

    // Parented to app.scope so unrelated hotkeys keep working while the menu is open.
    this.scope = new Scope(plugin.app.scope);
    this.scope.register([], "ArrowDown", () => this.move(1));
    this.scope.register([], "ArrowUp", () => this.move(-1));
    this.scope.register([], "Enter", () => {
      if (this.itemCount() === 0) {
        this.close();
        return true;
      }
      this.select(this.activeIndex);
      return false;
    });
    this.scope.register([], "Escape", () => {
      this.close();
      return false;
    });
    plugin.app.keymap.pushScope(this.scope);

    const closeIfOutside = (event: MouseEvent): void => {
      if (this.containerEl.contains(event.target as Node)) return;
      this.close();
    };
    doc.addEventListener("mousedown", closeIfOutside, true);
    this.cleanupListeners.push(() =>
      doc.removeEventListener("mousedown", closeIfOutside, true),
    );

    this.resizeObserver = new ResizeObserver(() => this.reposition());
    this.resizeObserver.observe(this.containerEl);

    this.render();
  }

  setQuery(query: string): void {
    if (query === this.query) return;
    this.query = query;
    this.activeIndex = 0;
    this.render();
  }

  close(): void {
    for (const cleanup of this.cleanupListeners) cleanup();
    this.cleanupListeners = [];
    this.plugin.app.keymap.popScope(this.scope);
    this.resizeObserver.disconnect();
    // Deferred: unmounting during React's event handling warns.
    const root = this.root;
    (this.view.dom.ownerDocument.defaultView ?? window).setTimeout(
      () => root.unmount(),
      0,
    );
    this.containerEl.remove();
    if (activeMenu === this) activeMenu = null;
  }

  private itemCount(): number {
    return this.groups.reduce((count, group) => count + group.nodes.length, 0);
  }

  private move(delta: number): boolean {
    const count = this.itemCount();
    // Nothing to move through, so the editor gets the arrow key.
    if (count === 0) return true;
    this.activeIndex = (this.activeIndex + delta + count) % count;
    this.render();
    return false;
  }

  private select(index: number): void {
    const node = this.groups.flatMap((group) => group.nodes)[index];
    if (!node) return;

    const sourcePath = this.view.state.field(editorInfoField, false)?.file
      ?.path;
    const link = this.plugin.app.fileManager.generateMarkdownLink(
      node.file,
      sourcePath ?? "",
    );
    const to = this.view.state.selection.main.head;
    const from = this.triggerFrom;

    this.close();
    this.view.dispatch({
      changes: { from, to, insert: link },
      selection: { anchor: from + link.length },
      userEvent: "input.complete",
    });
    this.view.focus();
  }

  private render(): void {
    this.groups = groupNodesForSummonMenu({
      nodes: this.nodes,
      nodeTypes: this.plugin.settings.nodeTypes,
      query: this.query,
    });
    this.root.render(
      <NodeSummonList
        groups={this.groups}
        activeIndex={this.activeIndex}
        onSelect={(index) => this.select(index)}
        onHover={(index) => {
          if (index === this.activeIndex) return;
          this.activeIndex = index;
          this.render();
        }}
      />,
    );
  }

  // Editor layout can only be read in a measure phase, not during an update.
  private reposition(): void {
    this.view.requestMeasure({
      read: (view) => view.coordsAtPos(this.triggerFrom),
      write: (coords) => {
        if (!coords) return;
        const win = this.view.dom.ownerDocument.defaultView ?? window;
        const { width, height } = this.containerEl.getBoundingClientRect();
        const left = Math.min(
          Math.max(VIEWPORT_MARGIN, coords.left),
          Math.max(VIEWPORT_MARGIN, win.innerWidth - width - VIEWPORT_MARGIN),
        );
        const spaceBelow = win.innerHeight - coords.bottom;
        const openUpward =
          spaceBelow < height + VIEWPORT_MARGIN && coords.top > spaceBelow;
        const top = openUpward
          ? Math.max(VIEWPORT_MARGIN, coords.top - height - 4)
          : coords.bottom + 4;
        this.containerEl.style.left = `${left}px`;
        this.containerEl.style.top = `${top}px`;
      },
    });
  }
}

let activeMenu: NodeSummonMenu | null = null;

export const getActiveNodeSummonMenu = (): NodeSummonMenu | null => activeMenu;

export const openNodeSummonMenu = (options: NodeSummonMenuOptions): void => {
  activeMenu?.close();
  activeMenu = new NodeSummonMenu(options);
};

export const closeNodeSummonMenu = (): void => {
  activeMenu?.close();
};
