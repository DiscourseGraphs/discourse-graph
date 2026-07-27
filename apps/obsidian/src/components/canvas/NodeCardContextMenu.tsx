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
import {
  FEATURE_FLAGS,
  NODE_CARD_CONTEXT_MENU_FLAG_CHANGED_EVENT,
} from "~/constants";
import type { DiscourseNodeShape } from "./shapes/DiscourseNodeShape";
import { RelationsPanel } from "./overlays/RelationPanel";

type NodeCardContextMenuProps = TLUiStylePanelProps & {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

type NodeCardContextMenuTab = "context" | "styling";

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
  const [isEnabled, setIsEnabled] = useState(
    plugin.settings[FEATURE_FLAGS.NODE_CARD_CONTEXT_MENU] ?? false,
  );
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
    const updateFlag = () =>
      setIsEnabled(
        plugin.settings[FEATURE_FLAGS.NODE_CARD_CONTEXT_MENU] ?? false,
      );
    window.addEventListener(
      NODE_CARD_CONTEXT_MENU_FLAG_CHANGED_EVENT,
      updateFlag,
    );
    return () =>
      window.removeEventListener(
        NODE_CARD_CONTEXT_MENU_FLAG_CHANGED_EVENT,
        updateFlag,
      );
  }, [plugin]);

  useEffect(() => {
    setActiveTab("context");
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return createElement(DefaultStylePanelComponent, { isMobile });
  }

  return createElement(
    DefaultStylePanelComponent,
    { isMobile },
    <>
      <div className="grid grid-cols-2 border-b border-[var(--color-divider)] bg-[var(--color-panel)]">
        {(["context", "styling"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={activeTab === tab}
            className={[
              "border-b-2 px-3 py-2 text-xs font-semibold capitalize",
              activeTab === tab
                ? "border-[var(--color-selected)] text-[var(--color-selected)]"
                : "border-transparent text-[var(--color-text-2)]",
            ].join(" ")}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-h-[min(32rem,calc(100vh-6rem))] overflow-y-auto">
        {activeTab === "context" ? (
          <RelationsPanel
            plugin={plugin}
            canvasFile={canvasFile}
            nodeShape={selectedNode}
            embedded
          />
        ) : (
          createElement(DefaultStylePanelContentComponent, { styles })
        )}
      </div>
    </>,
  );
};
