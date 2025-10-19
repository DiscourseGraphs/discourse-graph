/* eslint-disable @typescript-eslint/naming-convention */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DraggableProvided,
  DraggableStateSnapshot,
  DroppableProvided,
  DragStart,
  DraggableRubric,
} from "@hello-pangea/dnd";
import {
  Collapse,
  Icon,
  Popover,
  Menu,
  MenuItem,
  MenuDivider,
  Divider,
  Position,
  PopoverInteractionKind,
  TabId,
} from "@blueprintjs/core";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import extractRef from "roamjs-components/util/extractRef";
import {
  getFormattedConfigTree,
  notify,
  subscribe,
} from "~/utils/discourseConfigRef";
import type {
  LeftSidebarConfig,
  LeftSidebarPersonalSectionConfig,
} from "~/utils/getLeftSidebarSettings";
import { createBlock } from "roamjs-components/writes";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { Dispatch, SetStateAction } from "react";
import { SettingsDialog } from "./settings/Settings";
import { OnloadArgs } from "roamjs-components/types";
import renderOverlay from "roamjs-components/util/renderOverlay";

const parseReference = (text: string) => {
  const extracted = extractRef(text);
  if (text.startsWith("((") && text.endsWith("))")) {
    return { type: "block" as const, uid: extracted, display: text };
  } else {
    return { type: "page" as const, display: text };
  }
};

const truncate = (s: string, max: number | undefined): string => {
  if (!max || max <= 0) return s;
  return s.length > max ? `${s.slice(0, max)}...` : s;
};

const openTarget = async (e: React.MouseEvent, sectionTitle: string) => {
  e.preventDefault();
  e.stopPropagation();
  const target = parseReference(sectionTitle);
  if (target.type === "block") {
    if (e.shiftKey) {
      await openBlockInSidebar(target.uid);
      return;
    }
    await window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: { uid: target.uid },
    });
    return;
  }

  const uid = getPageUidByPageTitle(sectionTitle);
  if (!uid) return;
  if (e.shiftKey) {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      // @ts-expect-error - todo test
      // eslint-disable-next-line @typescript-eslint/naming-convention
      window: { type: "outline", "block-uid": uid },
    });
  } else {
    await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
  }
};

const toggleFoldedState = ({
  isOpen,
  setIsOpen,
  folded,
  parentUid,
}: {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  folded: { uid?: string; value: boolean };
  parentUid: string;
}) => {
  if (isOpen) {
    setIsOpen(false);
    if (folded.uid) {
      void deleteBlock(folded.uid);
      folded.uid = undefined;
      folded.value = false;
    }
  } else {
    setIsOpen(true);
    const newUid = window.roamAlphaAPI.util.generateUID();
    void createBlock({
      parentUid,
      node: { text: "Folded", uid: newUid },
    });
    folded.uid = newUid;
    folded.value = true;
  }
};

const SectionChildren = ({
  childrenNodes,
  truncateAt,
}: {
  childrenNodes: { uid: string; text: string }[];
  truncateAt?: number;
}) => {
  if (!childrenNodes?.length) return null;
  return (
    <>
      {childrenNodes.map((child) => {
        const ref = parseReference(child.text);
        const label = truncate(ref.display, truncateAt);
        const onClick = (e: React.MouseEvent) => {
          return void openTarget(e, child.text);
        };
        return (
          <div key={child.uid} className="pl-8 pr-2.5">
            <div
              className={
                "section-child-item page cursor-pointer rounded-sm leading-normal text-gray-600"
              }
              onClick={onClick}
            >
              {label}
            </div>
          </div>
        );
      })}
    </>
  );
};

const PersonalSectionItem = ({
  section,
  activeDragSourceId,
}: {
  section: LeftSidebarPersonalSectionConfig;
  activeDragSourceId: string | null;
}) => {
  const titleRef = parseReference(section.text);
  const blockText = useMemo(
    () =>
      titleRef.type === "block" ? getTextByBlockUid(titleRef.uid) : undefined,
    [titleRef],
  );
  const truncateAt = section.settings?.truncateResult.value;
  const [isOpen, setIsOpen] = useState<boolean>(
    !!section.settings?.folded.value || false,
  );

  const renderChild = (
    dragProvided: DraggableProvided,
    child: { text: string; uid: string },
  ) => {
    const ref = parseReference(child.text);
    const label = truncate(ref.display, truncateAt);
    const onClick = (e: React.MouseEvent) => {
      return void openTarget(e, child.text);
    };
    return (
      <div
        ref={dragProvided.innerRef}
        {...dragProvided.draggableProps}
        {...dragProvided.dragHandleProps}
        style={dragProvided.draggableProps.style}
        className="pl-8 pr-2.5"
      >
        <div
          className="section-child-item page cursor-pointer rounded-sm leading-normal text-gray-600"
          onClick={onClick}
        >
          {label}
        </div>
      </div>
    );
  };

  const handleChevronClick = () => {
    if (!section.settings) return;

    toggleFoldedState({
      isOpen,
      setIsOpen,
      folded: section.settings.folded,
      parentUid: section.settings.uid || "",
    });
  };

  return (
    <>
      <div className="sidebar-title-button flex w-full cursor-pointer items-center border-none bg-transparent pl-6 pr-2.5 font-semibold outline-none">
        <div className="flex w-full items-center justify-between">
          <div
            className="flex items-center"
            onClick={(e: React.MouseEvent) => {
              if ((section.children?.length || 0) > 0) {
                handleChevronClick();
              } else {
                void openTarget(e, section.text);
              }
            }}
          >
            {(blockText || titleRef.display).toUpperCase()}
          </div>
          {(section.children?.length || 0) > 0 && (
            <span
              className="sidebar-title-button-chevron p-1"
              onClick={handleChevronClick}
            >
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          )}
        </div>
      </div>
      <Collapse isOpen={isOpen} keepChildrenMounted>
        <Droppable
          droppableId={section.uid}
          type="ITEMS"
          isDropDisabled={
            !!activeDragSourceId && activeDragSourceId !== section.uid
          }
          renderClone={(
            provided: DraggableProvided,
            _: DraggableStateSnapshot,
            rubric: DraggableRubric,
          ) => {
            const child = (section.children || [])[rubric.source.index];
            return renderChild(provided, child);
          }}
        >
          {(provided: DroppableProvided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {(section.children || []).map((child, index) => (
                <Draggable
                  key={child.uid}
                  draggableId={child.uid}
                  index={index}
                  isDragDisabled={(section.children || []).length <= 1}
                >
                  {(dragProvided: DraggableProvided) => {
                    return renderChild(dragProvided, child);
                  }}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </Collapse>
    </>
  );
};

const PersonalSections = ({
  config,
  setConfig,
}: {
  config: LeftSidebarConfig;
  setConfig: Dispatch<SetStateAction<LeftSidebarConfig>>;
}) => {
  const sections = config.personal.sections || [];
  const [activeDragSourceId, setActiveDragSourceId] = useState<string | null>(
    null,
  );

  if (!sections.length) return null;

  const handleDragStart = (start: DragStart) => {
    if (start.type === "ITEMS") {
      setActiveDragSourceId(start.source.droppableId);
    }
  };

  const handleDragEnd = (result: DropResult) => {
    setActiveDragSourceId(null);
    const { source, destination, type } = result;

    if (!destination) return;

    if (type === "SECTIONS") {
      if (destination.index === source.index) return;

      const newPersonalSections = Array.from(config.personal.sections);
      const [removed] = newPersonalSections.splice(source.index, 1);
      newPersonalSections.splice(destination.index, 0, removed);

      setConfig({
        ...config,
        personal: { ...config.personal, sections: newPersonalSections },
      });
      const finalIndex =
        destination.index > source.index
          ? destination.index + 1
          : destination.index;
      void window.roamAlphaAPI.moveBlock({
        location: { "parent-uid": config.personal.uid, order: finalIndex },
        block: { uid: removed.uid },
      });
      return;
    }

    if (type === "ITEMS") {
      if (source.droppableId !== destination.droppableId) {
        return;
      }

      if (destination.index === source.index) {
        return;
      }

      const newConfig = JSON.parse(JSON.stringify(config)) as LeftSidebarConfig;
      const { personal } = newConfig;

      const listToReorder = personal.sections.find(
        (s) => s.uid === source.droppableId,
      );
      const parentUid = listToReorder?.childrenUid;
      const listToReorderChildren = listToReorder?.children;

      if (!listToReorderChildren) return;

      const [removedItem] = listToReorderChildren.splice(source.index, 1);
      listToReorderChildren.splice(destination.index, 0, removedItem);

      setConfig(newConfig);
      const finalIndex =
        destination.index > source.index
          ? destination.index + 1
          : destination.index;
      void window.roamAlphaAPI.moveBlock({
        location: { "parent-uid": parentUid || "", order: finalIndex },
        block: { uid: removedItem.uid },
      });
    }
  };
  return (
    <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
      <Droppable droppableId="personal-sections" type="SECTIONS">
        {(provided: DroppableProvided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="personal-left-sidebar-sections"
          >
            {sections.map((section, index) => (
              <Draggable
                key={section.uid}
                draggableId={section.uid}
                index={index}
                isDragDisabled={sections.length <= 1}
              >
                {(dragProvided: DraggableProvided) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                    style={dragProvided.draggableProps.style}
                  >
                    <PersonalSectionItem
                      section={section}
                      activeDragSourceId={activeDragSourceId}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

const GlobalSection = ({ config }: { config: LeftSidebarConfig["global"] }) => {
  const [isOpen, setIsOpen] = useState<boolean>(
    !!config.settings?.folded.value,
  );
  if (!config.children?.length) return null;
  const isCollapsable = config.settings?.collapsable.value;

  return (
    <>
      <div
        className="sidebar-title-button flex w-full items-center border-none bg-transparent py-1 pl-6 pr-2.5 font-semibold outline-none"
        onClick={() => {
          if (!isCollapsable || !config.settings) return;
          toggleFoldedState({
            isOpen,
            setIsOpen,
            folded: config.settings.folded,
            parentUid: config.settings.uid,
          });
        }}
      >
        <div className="flex w-full items-center justify-between">
          <span>GLOBAL</span>
          {isCollapsable && (
            <span className="sidebar-title-button-chevron p-1">
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          )}
        </div>
      </div>
      {isCollapsable ? (
        <Collapse isOpen={isOpen} keepChildrenMounted>
          <SectionChildren childrenNodes={config.children} />
        </Collapse>
      ) : (
        <SectionChildren childrenNodes={config.children} />
      )}
    </>
  );
};

export const useConfig = () => {
  const [config, setConfig] = useState(
    () => getFormattedConfigTree().leftSidebar,
  );
  useEffect(() => {
    const handleUpdate = () => {
      setConfig(getFormattedConfigTree().leftSidebar);
    };
    const unsubscribe = subscribe(handleUpdate);
    return () => {
      unsubscribe();
    };
  }, []);
  return config;
};

export const refreshAndNotify = () => {
  refreshConfigTree();
  notify();
};

const FavouritesPopover = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLSpanElement | null>(null);

  const handleGlobalPointerDownCapture = useCallback(
    (e: Event) => {
      if (!isMenuOpen) return;
      const target = e.target as Node | null;
      if (!target) return;

      if (menuTriggerRef.current && menuTriggerRef.current.contains(target)) {
        return;
      }
      const popoverEl = document.querySelector(".dg-leftsidebar-popover");
      if (popoverEl && popoverEl.contains(target)) {
        return;
      }

      setIsMenuOpen(false);
    },
    [isMenuOpen],
  );

  useEffect(() => {
    if (!isMenuOpen) return;
    const opts = { capture: true } as AddEventListenerOptions;
    window.addEventListener(
      "mousedown",
      handleGlobalPointerDownCapture as EventListener,
      opts,
    );
    window.addEventListener(
      "pointerdown",
      handleGlobalPointerDownCapture as EventListener,
      opts,
    );
    return () => {
      window.removeEventListener(
        "mousedown",
        handleGlobalPointerDownCapture as EventListener,
        opts,
      );
      window.removeEventListener(
        "pointerdown",
        handleGlobalPointerDownCapture as EventListener,
        opts,
      );
    };
  }, [handleGlobalPointerDownCapture, isMenuOpen]);

  const renderSettingsDialog = (tabId: TabId) => {
    renderOverlay({
      Overlay: SettingsDialog,
      props: {
        onloadArgs,
        selectedTabId: tabId,
      },
    });
  };

  return (
    <>
      <Divider className="mx-5" style={{ borderColor: "rgb(57, 75, 89)" }} />
      <div style={{ height: "8px" }}></div>
      <div className="flex w-full items-center justify-between pb-1 pl-6 pr-2.5 font-semibold">
        <span className="flex items-baseline">
          <Icon icon="star" iconSize={14} />
          <div style={{ width: 8 }}></div>
          FAVOURITES
        </span>
        <Popover
          interactionKind={PopoverInteractionKind.CLICK}
          position={Position.BOTTOM_RIGHT}
          autoFocus={false}
          enforceFocus={false}
          captureDismiss
          hasBackdrop
          isOpen={isMenuOpen}
          onInteraction={(next) => setIsMenuOpen(next)}
          onClose={() => setIsMenuOpen(false)}
          popoverClassName="dg-leftsidebar-popover"
          minimal
          content={
            <Menu>
              <MenuDivider title="Add Or Edit" />
              <MenuItem
                text="Global Section"
                onClick={() => {
                  renderSettingsDialog("left-sidebar-global-settings");
                  setIsMenuOpen(false);
                }}
              />
              <MenuItem
                text="Personal Section"
                onClick={() => {
                  renderSettingsDialog("left-sidebar-personal-settings");
                  setIsMenuOpen(false);
                }}
              />
            </Menu>
          }
        >
          <span ref={menuTriggerRef} className="sidebar-title-button-add p-1">
            <Icon icon="plus" iconSize={14} />
          </span>
        </Popover>
      </div>
    </>
  );
};

const LeftSidebarView = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const initialConfig = useConfig();
  const [config, setConfig] = useState(initialConfig);
  return (
    <>
      <FavouritesPopover onloadArgs={onloadArgs} />
      <GlobalSection config={config.global} />
      <PersonalSections config={config} setConfig={setConfig} />
    </>
  );
};

export const mountLeftSidebar = (
  wrapper: HTMLElement,
  onloadArgs: OnloadArgs,
): void => {
  if (!wrapper) return;
  wrapper.innerHTML = "";

  const id = "dg-left-sidebar-root";
  let root = wrapper.querySelector(`#${id}`) as HTMLDivElement;
  if (!root) {
    const existingStarred = wrapper.querySelector(".starred-pages");
    if (existingStarred) {
      existingStarred.remove();
    }
    root = document.createElement("div");
    root.id = id;
    root.className = "starred-pages";
    root.onmousedown = (e) => e.stopPropagation();
    wrapper.appendChild(root);
  } else {
    root.className = "starred-pages";
  }
  ReactDOM.render(<LeftSidebarView onloadArgs={onloadArgs} />, root);
};

export default LeftSidebarView;
