import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent,
  type ComponentType,
  type RefObject,
} from "react";
import type { TFile } from "obsidian";
import {
  DefaultStylePanel,
  useEditor,
  usePassThroughWheelEvents,
  useValue,
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
  createNodeCardContextMenuState,
  nodeCardContextMenuReducer,
  shouldShowNodeCardContextMenu,
  type NodeCardContextMenuTab,
} from "./nodeCardContextMenuModel";

type NodeCardContextMenuProps = TLUiStylePanelProps & {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

const TABS: NodeCardContextMenuTab[] = ["context", "styling"];
const DefaultStylePanelComponent =
  DefaultStylePanel as unknown as ComponentType<TLUiStylePanelProps>;

export const NodeCardContextMenu = ({
  plugin,
  canvasFile,
  isMobile,
}: NodeCardContextMenuProps) => {
  const editor = useEditor();
  const panelRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<
    Partial<Record<NodeCardContextMenuTab, HTMLButtonElement>>
  >({});
  const tabIdPrefix = useId();
  const [isEnabled, setIsEnabled] = useState(
    plugin.settings[FEATURE_FLAGS.NODE_CARD_CONTEXT_MENU] ?? false,
  );

  usePassThroughWheelEvents(panelRef as RefObject<HTMLElement>);

  useEffect(() => {
    const syncFlag = () => {
      setIsEnabled(
        plugin.settings[FEATURE_FLAGS.NODE_CARD_CONTEXT_MENU] ?? false,
      );
    };
    window.addEventListener(
      NODE_CARD_CONTEXT_MENU_FLAG_CHANGED_EVENT,
      syncFlag,
    );
    return () => {
      window.removeEventListener(
        NODE_CARD_CONTEXT_MENU_FLAG_CHANGED_EVENT,
        syncFlag,
      );
    };
  }, [plugin]);

  const selectedShape = useValue(
    "selected shape for node card context menu",
    () => editor.getOnlySelectedShape(),
    [editor],
  );
  const showNodeCardContextMenu = shouldShowNodeCardContextMenu({
    isEnabled,
    selectedShapeType: selectedShape?.type,
  });
  const selectedNode = showNodeCardContextMenu
    ? (selectedShape as DiscourseNodeShape)
    : null;

  const [state, dispatch] = useReducer(
    nodeCardContextMenuReducer,
    selectedNode?.id ?? null,
    createNodeCardContextMenuState,
  );

  useEffect(() => {
    dispatch({
      type: "sync-selection",
      selectedShapeId: selectedNode?.id ?? null,
    });
  }, [selectedNode?.id]);

  const selectTab = useCallback((tab: NodeCardContextMenuTab) => {
    dispatch({ type: "select-tab", tab });
  }, []);

  const handleTabKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const currentIndex = TABS.indexOf(state.activeTab);
      let nextTab: NodeCardContextMenuTab | undefined;

      if (event.key === "ArrowLeft") {
        nextTab = TABS[(currentIndex - 1 + TABS.length) % TABS.length];
      } else if (event.key === "ArrowRight") {
        nextTab = TABS[(currentIndex + 1) % TABS.length];
      } else if (event.key === "Home") {
        nextTab = TABS[0];
      } else if (event.key === "End") {
        nextTab = TABS[TABS.length - 1];
      }

      if (!nextTab) return;
      event.preventDefault();
      selectTab(nextTab);
      tabButtonRefs.current[nextTab]?.focus();
    },
    [selectTab, state.activeTab],
  );

  if (!selectedNode) {
    return createElement(DefaultStylePanelComponent, { isMobile });
  }

  return (
    <div
      ref={panelRef}
      className={[
        "dg-node-card-menu tlui-style-panel",
        !isMobile && "tlui-style-panel__wrapper",
      ]
        .filter(Boolean)
        .join(" ")}
      data-ismobile={isMobile}
      onPointerLeave={() => {
        if (!isMobile) {
          editor.updateInstanceState({ isChangingStyle: false });
        }
      }}
    >
      <div
        className="dg-node-card-menu__tabs"
        role="tablist"
        aria-label="Node card menu"
      >
        {TABS.map((tab) => {
          const isActive = state.activeTab === tab;
          return (
            <button
              key={tab}
              ref={(button) => {
                tabButtonRefs.current[tab] = button ?? undefined;
              }}
              id={`${tabIdPrefix}-${tab}-tab`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tabIdPrefix}-${tab}-panel`}
              tabIndex={isActive ? 0 : -1}
              className={["dg-node-card-menu__tab", isActive && "is-active"]
                .filter(Boolean)
                .join(" ")}
              onClick={() => selectTab(tab)}
              onKeyDown={handleTabKeyDown}
            >
              {tab === "context" ? "Context" : "Styling"}
            </button>
          );
        })}
      </div>

      <div
        id={`${tabIdPrefix}-${state.activeTab}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabIdPrefix}-${state.activeTab}-tab`}
        className="dg-node-card-menu__panel"
      >
        {state.activeTab === "context" ? (
          <RelationsPanel
            plugin={plugin}
            canvasFile={canvasFile}
            nodeShape={selectedNode}
            variant="node-card-context"
          />
        ) : (
          <div className="dg-node-card-menu__styling">
            {createElement(DefaultStylePanelComponent, { isMobile: true })}
          </div>
        )}
      </div>
    </div>
  );
};
