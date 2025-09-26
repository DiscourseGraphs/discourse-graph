/* eslint-disable @typescript-eslint/naming-convention */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  memo,
  ReactNode,
} from "react";
import { Button, Collapse, Icon } from "@blueprintjs/core";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import type { RoamBasicNode } from "roamjs-components/types";
import { getSubTree } from "roamjs-components/util";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import discourseConfigRef from "~/utils/discourseConfigRef";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import { getLeftSidebarGlobalSectionConfig } from "~/utils/getLeftSidebarSettings";
import { LeftSidebarGlobalSectionConfig } from "~/utils/getLeftSidebarSettings";
import { render as renderToast } from "roamjs-components/components/Toast";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DraggableProvided,
  DraggableRubric,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { refreshAndNotify } from "~/components/LeftSidebarView";

const PageItem = memo(
  ({
    page,
    onRemove,
    dragProvided,
  }: {
    page: RoamBasicNode;
    onRemove: (page: RoamBasicNode) => void;
    dragProvided: DraggableProvided;
  }) => {
    return (
      <div
        ref={dragProvided.innerRef}
        {...dragProvided.draggableProps}
        style={dragProvided.draggableProps.style}
        className="flex items-center justify-between rounded bg-gray-50 p-2 hover:bg-gray-100"
      >
        <div {...dragProvided.dragHandleProps} className="pr-2">
          <Icon icon="drag-handle-vertical" className="cursor-grab" />
        </div>
        <span className="flex-grow truncate">{page.text}</span>
        <Button
          icon="trash"
          minimal
          small
          intent="danger"
          onClick={() => onRemove(page)}
          title="Remove page"
        />
      </div>
    );
  },
);

PageItem.displayName = "PageItem";

const LeftSidebarGlobalSectionsContent = ({
  leftSidebar,
}: {
  leftSidebar: RoamBasicNode;
}) => {
  const [globalSection, setGlobalSection] =
    useState<LeftSidebarGlobalSectionConfig | null>(null);
  const [pages, setPages] = useState<RoamBasicNode[]>([]);
  const [childrenUid, setChildrenUid] = useState<string | null>(null);
  const [newPageInput, setNewPageInput] = useState("");
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const pageNames = useMemo(() => getAllPageNames(), []);

  useEffect(() => {
    const initialize = async () => {
      setIsInitializing(true);
      const globalSectionText = "Global-Section";
      const config = getLeftSidebarGlobalSectionConfig(leftSidebar.children);

      const existingGlobalSection = leftSidebar.children.find(
        (n) => n.text === globalSectionText,
      );

      if (!existingGlobalSection) {
        try {
          const globalSectionUid = await createBlock({
            parentUid: leftSidebar.uid,
            order: 0,
            node: { text: globalSectionText },
          });
          const settingsUid = await createBlock({
            parentUid: globalSectionUid,
            order: 0,
            node: { text: "Settings" },
          });
          const childrenUid = await createBlock({
            parentUid: globalSectionUid,
            order: 0,
            node: { text: "Children" },
          });
          setChildrenUid(childrenUid || null);
          setPages([]);
          setGlobalSection({
            uid: globalSectionUid,
            settings: {
              uid: settingsUid,
              collapsable: { uid: undefined, value: false },
              folded: { uid: undefined, value: false },
            },
            childrenUid,
            children: [],
          });
          refreshAndNotify();
        } catch (error) {
          renderToast({
            content: "Failed to create global section",
            intent: "danger",
            id: "create-global-section-error",
          });
        }
      } else {
        setChildrenUid(config.childrenUid || null);
        setPages(config.children || []);
        setGlobalSection(config);
      }
      setIsInitializing(false);
    };

    void initialize();
  }, [leftSidebar]);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination } = result;
      if (!destination || destination.index === source.index) {
        return;
      }

      const newPages = Array.from(pages);
      const [removed] = newPages.splice(source.index, 1);
      newPages.splice(destination.index, 0, removed);

      setPages(newPages);

      if (childrenUid) {
        const order =
          destination.index > source.index
            ? destination.index + 1
            : destination.index;

        void window.roamAlphaAPI
          .moveBlock({
            location: { "parent-uid": childrenUid, order: order },
            block: { uid: removed.uid },
          })
          .then(() => {
            refreshAndNotify();
          });
      }
    },
    [pages, childrenUid],
  );

  const addPage = useCallback(
    async (pageName: string) => {
      if (!pageName || !childrenUid) return;

      if (pages.some((p) => p.text === pageName)) {
        console.warn(`Page "${pageName}" already exists in global section`);
        return;
      }

      try {
        const newPageUid = await createBlock({
          parentUid: childrenUid,
          order: "last",
          node: { text: pageName },
        });

        const newPage: RoamBasicNode = {
          text: pageName,
          uid: newPageUid,
          children: [],
        };

        setPages((prev) => [...prev, newPage]);
        setNewPageInput("");
        setAutocompleteKey((prev) => prev + 1);
        refreshAndNotify();
      } catch (error) {
        renderToast({
          content: "Failed to add page",
          intent: "danger",
          id: "add-page-error",
        });
      }
    },
    [childrenUid, pages],
  );

  const removePage = useCallback(async (page: RoamBasicNode) => {
    try {
      await deleteBlock(page.uid);
      setPages((prev) => prev.filter((p) => p.uid !== page.uid));
      refreshAndNotify();
    } catch (error) {
      renderToast({
        content: "Failed to remove page",
        intent: "danger",
        id: "remove-page-error",
      });
    }
  }, []);

  const handlePageInputChange = useCallback((value: string) => {
    setNewPageInput(value);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && newPageInput) {
        e.preventDefault();
        e.stopPropagation();
        void addPage(newPageInput);
      }
    },
    [newPageInput, addPage],
  );

  const toggleChildren = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const isAddButtonDisabled = useMemo(
    () => !newPageInput || pages.some((p) => p.text === newPageInput),
    [newPageInput, pages],
  );

  if (isInitializing || !globalSection) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      <div
        className="global-section-settings rounded-md p-3 hover:bg-gray-50"
        style={{
          border: "1px solid rgba(51, 51, 51, 0.2)",
        }}
      >
        <FlagPanel
          title="Folded"
          description="If children are present, start with global section collapsed in left sidebar"
          order={0}
          uid={globalSection.settings?.folded?.uid || ""}
          parentUid={globalSection.settings?.uid || ""}
          disabled={!globalSection.children?.length}
        />
        <FlagPanel
          title="Collapsable"
          description="Make global section collapsable"
          order={1}
          uid={globalSection.settings?.collapsable?.uid || ""}
          parentUid={globalSection.settings?.uid || ""}
          value={globalSection.settings?.collapsable?.value || false}
        />
      </div>

      <div
        className="global-section-children rounded-md p-3 hover:bg-gray-50"
        style={{
          border: "1px solid rgba(51, 51, 51, 0.2)",
        }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              icon={isExpanded ? "chevron-down" : "chevron-right"}
              minimal
              small
              onClick={toggleChildren}
            />
            <span className="text-sm font-medium text-gray-700">Children</span>
          </div>
          <span className="text-sm text-gray-500">
            {pages.length} {pages.length === 1 ? "page" : "pages"}
          </span>
        </div>

        <Collapse isOpen={isExpanded}>
          <div className="ml-6">
            <div className="mb-2 text-sm text-gray-600">
              Add pages that will appear for all users
            </div>
            <div
              className="mb-3 flex items-center gap-2"
              onKeyDown={handleKeyDown}
            >
              <AutocompleteInput
                key={autocompleteKey}
                value={newPageInput}
                setValue={handlePageInputChange}
                placeholder="Add page…"
                options={pageNames}
                maxItemsDisplayed={50}
              />
              <Button
                icon="plus"
                small
                minimal
                disabled={isAddButtonDisabled}
                onClick={() => void addPage(newPageInput)}
                title="Add page"
              />
            </div>
            {pages.length > 0 ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable
                  droppableId="global-section-pages"
                  renderClone={(
                    provided: DraggableProvided,
                    _: DraggableStateSnapshot,
                    rubric: DraggableRubric,
                  ) => {
                    const page = pages[rubric.source.index];
                    return (
                      <PageItem
                        page={page}
                        onRemove={() => void removePage(page)}
                        dragProvided={provided}
                      />
                    );
                  }}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-1"
                    >
                      {pages.map((page, index) => (
                        <Draggable
                          key={page.uid}
                          draggableId={page.uid}
                          index={index}
                        >
                          {(dragProvided: DraggableProvided): ReactNode => (
                            <PageItem
                              page={page}
                              onRemove={() => void removePage(page)}
                              dragProvided={dragProvided}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <div className="text-sm italic text-gray-400">
                No pages added yet
              </div>
            )}
          </div>
        </Collapse>
      </div>
    </div>
  );
};

export const LeftSidebarGlobalSections = () => {
  const [leftSidebar, setLeftSidebar] = useState<RoamBasicNode | null>(null);

  useEffect(() => {
    const loadData = () => {
      refreshConfigTree();

      const configPageUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
      const updatedSettings = discourseConfigRef.tree;
      const leftSidebarNode = getSubTree({
        tree: updatedSettings,
        parentUid: configPageUid,
        key: "Left Sidebar",
      });

      setTimeout(() => {
        refreshAndNotify();
      }, 10);
      setLeftSidebar(leftSidebarNode);
    };

    void loadData();
  }, []);

  if (!leftSidebar) {
    return null;
  }

  return <LeftSidebarGlobalSectionsContent leftSidebar={leftSidebar} />;
};
