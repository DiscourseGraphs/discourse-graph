import {
  createElement,
  useEffect,
  useReducer,
  useState,
  type ComponentType,
} from "react";
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
import {
  nodeCardContextMenuReducer,
  shouldShowNodeCardContextMenu,
  type NodeCardContextMenuTab,
} from "./nodeCardContextMenuModel";

type NodeCardContextMenuProps = TLUiStylePanelProps & {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

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
  const selectedNode = shouldShowNodeCardContextMenu(
    isEnabled,
    selectedShape?.type,
  )
    ? (selectedShape as DiscourseNodeShape)
    : null;
  const [menuState, dispatch] = useReducer(nodeCardContextMenuReducer, {
    activeTab: "context",
    selectedShapeId: selectedNode?.id ?? null,
  });

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
    dispatch({
      type: "select-node",
      selectedShapeId: selectedNode?.id ?? null,
    });
  }, [selectedNode?.id]);

  if (!selectedNode) {
    return createElement(DefaultStylePanelComponent, { isMobile });
  }

  const selectTab = (tab: NodeCardContextMenuTab) =>
    dispatch({ type: "select-tab", tab });

  return createElement(
    DefaultStylePanelComponent,
    { isMobile },
    <>
      <div className="grid grid-cols-2 border-b border-[var(--color-divider)] bg-[var(--color-panel)]">
        {(["context", "styling"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            aria-pressed={menuState.activeTab === tab}
            className={[
              "border-b-2 px-3 py-2 text-xs font-semibold capitalize",
              menuState.activeTab === tab
                ? "border-[var(--color-selected)] text-[var(--color-selected)]"
                : "border-transparent text-[var(--color-text-2)]",
            ].join(" ")}
            onClick={() => selectTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="max-h-[min(32rem,calc(100vh-6rem))] overflow-y-auto">
        {menuState.activeTab === "context" ? (
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
