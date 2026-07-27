import { createElement, useEffect, useState, type ComponentType } from "react";
import type { TFile } from "obsidian";
import {
  DefaultStylePanel,
  DefaultStylePanelContent,
  useEditor,
  useRelevantStyles,
  useValue,
  type TLUiStylePanelContentProps,
  type TLUiStylePanelProps,
} from "tldraw";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseNodeShape } from "./shapes/DiscourseNodeShape";
import { RelationsPanel } from "./overlays/RelationPanel";

type NodeCardContextMenuProps = TLUiStylePanelProps & {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

const NODE_CARD_CONTEXT_MENU_TABS = [
  { id: "context", label: "Context" },
  { id: "styling", label: "Styling" },
] as const;

type NodeCardContextMenuTab =
  (typeof NODE_CARD_CONTEXT_MENU_TABS)[number]["id"];

// tldraw is typed against React 19 while Obsidian runs React 18. The casts avoid
// adding TS2786 errors to this file when rendering these components.
const DefaultStylePanelComponent =
  DefaultStylePanel as unknown as ComponentType<TLUiStylePanelProps>;
const DefaultStylePanelContentComponent =
  DefaultStylePanelContent as unknown as ComponentType<TLUiStylePanelContentProps>;

export const NodeCardContextMenu = ({
  plugin,
  canvasFile,
  isMobile,
}: NodeCardContextMenuProps) => {
  const editor = useEditor();
  const styles = useRelevantStyles();
  const isEnabled = plugin.settings.nodeCardContextMenuEnabled ?? false;
  const selectedShape = useValue(
    "selected shape for node card context menu",
    () => editor.getOnlySelectedShape(),
    [editor],
  );
  const selectedNode =
    isEnabled && selectedShape?.type === "discourse-node"
      ? (selectedShape as DiscourseNodeShape)
      : null;
  const [activeTab, setActiveTab] = useState<NodeCardContextMenuTab>("context");

  useEffect(() => {
    setActiveTab("context");
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return createElement(DefaultStylePanelComponent, { isMobile });
  }

  return createElement(
    DefaultStylePanelComponent,
    { isMobile },
    <div className="dg-node-card-menu">
      <div className="grid grid-cols-2 border-b border-[var(--color-divider)] bg-[var(--color-panel)]">
        {NODE_CARD_CONTEXT_MENU_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeTab === id}
            className={[
              "border-b-2 px-3 py-2 text-xs font-semibold",
              activeTab === id
                ? "border-[var(--color-selected)] text-[var(--color-selected)]"
                : "border-transparent text-[var(--color-text-3)]",
            ].join(" ")}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "context" ? (
          <RelationsPanel
            plugin={plugin}
            canvasFile={canvasFile}
            nodeShape={selectedNode}
            embedded
            includeAllDirections
          />
        ) : (
          createElement(DefaultStylePanelContentComponent, { styles })
        )}
      </div>
    </div>,
  );
};
