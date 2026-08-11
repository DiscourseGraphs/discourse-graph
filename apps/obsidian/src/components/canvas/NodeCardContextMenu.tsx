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
import { RelationsPanelContent } from "./overlays/RelationPanel";

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
    () =>
      editor.getCurrentToolId() === "select"
        ? editor.getOnlySelectedShape()
        : null,
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
      <div className="border-modifier-border grid grid-cols-2 border-b">
        {NODE_CARD_CONTEXT_MENU_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={activeTab === id}
            className={`cursor-pointer px-3 py-2 text-xs font-semibold ${
              activeTab === id ? "accent-border-bottom" : ""
            }`}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "context" ? (
        <div className="p-3">
          <RelationsPanelContent
            plugin={plugin}
            canvasFile={canvasFile}
            nodeShape={selectedNode}
          />
        </div>
      ) : (
        createElement(DefaultStylePanelContentComponent, { styles })
      )}
    </div>,
  );
};
