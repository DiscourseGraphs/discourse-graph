import discourseConfigRef from "~/utils/discourseConfigRef";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { Button, Dialog, Collapse, InputGroup, Icon } from "@blueprintjs/core";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import type { RoamBasicNode } from "roamjs-components/types";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import {
  LeftSidebarPersonalSectionConfig,
  getLeftSidebarPersonalSectionConfig,
} from "~/utils/getLeftSidebarSettings";
import { extractRef, getSubTree } from "roamjs-components/util";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import { render as renderToast } from "roamjs-components/components/Toast";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { refreshAndNotify } from "~/components/LeftSidebarView";
import { memo, Dispatch, SetStateAction } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DraggableProvided,
  DroppableProvided,
  DraggableRubric,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";

const SectionItem = memo(
  ({
    section,
    setSettingsDialogSectionUid,
    pageNames,
    setSections,
    dragHandleProps,
  }: {
    section: LeftSidebarPersonalSectionConfig;
    setSections: Dispatch<SetStateAction<LeftSidebarPersonalSectionConfig[]>>;
    setSettingsDialogSectionUid: (uid: string | null) => void;
    pageNames: string[];
    dragHandleProps: DraggableProvided["dragHandleProps"];
  }) => {
    const ref = extractRef(section.text);
    const blockText = getTextByBlockUid(ref);
    const originalName = blockText || section.text;
    const [childInput, setChildInput] = useState("");
    const [childInputKey, setChildInputKey] = useState(0);

    const [expandedChildLists, setExpandedChildLists] = useState<Set<string>>(
      new Set(),
    );
    const isExpanded = expandedChildLists.has(section.uid);
    const toggleChildrenList = useCallback((sectionUid: string) => {
      setExpandedChildLists((prev) => {
        const next = new Set(prev);
        if (next.has(sectionUid)) {
          next.delete(sectionUid);
        } else {
          next.add(sectionUid);
        }
        return next;
      });
    }, []);

    const convertToComplexSection = useCallback(
      async (section: LeftSidebarPersonalSectionConfig) => {
        try {
          const settingsUid = await createBlock({
            parentUid: section.uid,
            order: 0,
            node: { text: "Settings" },
          });
          const foldedUid = await createBlock({
            parentUid: settingsUid,
            order: 0,
            node: { text: "Folded" },
          });
          const truncateSettingUid = await createBlock({
            parentUid: settingsUid,
            order: 1,
            node: { text: "Truncate-result?", children: [{ text: "75" }] },
          });

          const childrenUid = await createBlock({
            parentUid: section.uid,
            order: 1,
            node: { text: "Children" },
          });

          setSections((prev) =>
            prev.map((s) => {
              if (s.uid === section.uid) {
                return {
                  ...s,
                  settings: {
                    uid: settingsUid,
                    folded: { uid: foldedUid, value: false },
                    truncateResult: { uid: truncateSettingUid, value: 75 },
                  },
                  childrenUid,
                  children: [],
                };
              }
              return s;
            }),
          );

          setExpandedChildLists((prev) => new Set([...prev, section.uid]));
          refreshAndNotify();
        } catch (error) {
          renderToast({
            content: "Failed to convert to complex section",
            intent: "danger",
            id: "convert-to-complex-section-error",
          });
        }
      },
      [setSections],
    );

    const removeSection = useCallback(
      async (section: LeftSidebarPersonalSectionConfig) => {
        try {
          await deleteBlock(section.uid);

          setSections((prev) => prev.filter((s) => s.uid !== section.uid));
          refreshAndNotify();
        } catch (error) {
          renderToast({
            content: "Failed to remove section",
            intent: "danger",
            id: "remove-section-error",
          });
        }
      },
      [setSections],
    );

    const addChildToSection = useCallback(
      async (
        section: LeftSidebarPersonalSectionConfig,
        childrenUid: string,
        childName: string,
      ) => {
        if (!childName || !childrenUid) return;

        try {
          const newChild = await createBlock({
            parentUid: childrenUid,
            order: "last",
            node: { text: childName },
          });

          setSections((prev) =>
            prev.map((s) => {
              if (s.uid === section.uid) {
                return {
                  ...s,
                  children: [
                    ...(s.children || []),
                    {
                      text: childName,
                      uid: newChild,
                      children: [],
                    },
                  ],
                };
              }
              return s;
            }),
          );
          refreshAndNotify();
        } catch (error) {
          renderToast({
            content: "Failed to add child",
            intent: "danger",
            id: "add-child-error",
          });
        }
      },
      [setSections],
    );
    const removeChild = useCallback(
      async (
        section: LeftSidebarPersonalSectionConfig,
        child: RoamBasicNode,
      ) => {
        try {
          await deleteBlock(child.uid);

          setSections((prev) =>
            prev.map((s) => {
              if (s.uid === section.uid) {
                return {
                  ...s,
                  children: s.children?.filter((c) => c.uid !== child.uid),
                };
              }
              return s;
            }),
          );
          refreshAndNotify();
        } catch (error) {
          renderToast({
            content: "Failed to remove child",
            intent: "danger",
            id: "remove-child-error",
          });
        }
      },
      [setSections],
    );

    const handleAddChild = useCallback(async () => {
      if (childInput && section.childrenUid) {
        await addChildToSection(section, section.childrenUid, childInput);
        setChildInput("");
        setChildInputKey((prev) => prev + 1);
        refreshAndNotify();
      }
    }, [childInput, section, addChildToSection]);

    const sectionWithoutSettingsAndChildren =
      (!section.settings && section.children?.length === 0) ||
      !section.children;

    return (
      <div
        key={section.uid}
        className="personal-section rounded-md p-3 hover:bg-gray-50"
        style={{
          border: "1px solid rgba(51, 51, 51, 0.2)",
        }}
      >
        <div className="flex items-center">
          <div {...dragHandleProps}>
            <Icon icon="drag-handle-vertical" className="cursor-grab" />
          </div>
          <div style={{ width: "8px" }}></div>
          {!sectionWithoutSettingsAndChildren && (
            <Button
              icon={isExpanded ? "chevron-down" : "chevron-right"}
              minimal
              small
              onClick={() => toggleChildrenList(section.uid)}
            />
          )}
          <div
            className="flex-1 truncate"
            style={{
              cursor: sectionWithoutSettingsAndChildren ? "default" : "pointer",
            }}
            onClick={() =>
              !sectionWithoutSettingsAndChildren &&
              toggleChildrenList(section.uid)
            }
          >
            <span className="font-medium">{originalName}</span>
          </div>
          <Button
            icon={sectionWithoutSettingsAndChildren ? "plus" : "settings"}
            minimal
            title={
              sectionWithoutSettingsAndChildren
                ? "Add children"
                : "Edit section settings"
            }
            onClick={() =>
              sectionWithoutSettingsAndChildren
                ? void convertToComplexSection(section)
                : void setSettingsDialogSectionUid(section.uid)
            }
          />
          <Button
            icon="trash"
            minimal
            intent="danger"
            onClick={() => void removeSection(section)}
            title="Remove section"
          />
        </div>

        {!sectionWithoutSettingsAndChildren && (
          <Collapse isOpen={isExpanded}>
            <div className="ml-6 mt-3">
              <div
                className="mb-2 flex items-center gap-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && childInput) {
                    e.preventDefault();
                    e.stopPropagation();
                    void handleAddChild();
                  }
                }}
              >
                <AutocompleteInput
                  key={childInputKey}
                  value={childInput}
                  setValue={setChildInput}
                  placeholder="Add child page…"
                  options={pageNames}
                  maxItemsDisplayed={50}
                />
                <Button
                  icon="plus"
                  small
                  minimal
                  disabled={!childInput}
                  onClick={() => void handleAddChild()}
                  title="Add child"
                />
              </div>

              {(section.children || []).length > 0 && (
                <Droppable
                  droppableId={section.uid}
                  type="ITEMS"
                  /* eslint-disable @typescript-eslint/naming-convention */
                  renderClone={(
                    provided: DraggableProvided,
                    _: DraggableStateSnapshot,
                    rubric: DraggableRubric,
                  ) => {
                    const child = (section.children || [])[rubric.source.index];
                    return (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={provided.draggableProps.style}
                        className="flex items-center justify-between rounded bg-gray-50 p-2 hover:bg-gray-100"
                      >
                        <div {...provided.dragHandleProps} className="pr-2">
                          <Icon
                            icon="drag-handle-vertical"
                            className="cursor-grab"
                          />
                        </div>

                        <span className="flex-grow">{child.text}</span>
                        <Button
                          icon="trash"
                          minimal
                          small
                          intent="danger"
                          onClick={() => void removeChild(section, child)}
                          title="Remove child"
                        />
                      </div>
                    );
                  }}
                >
                  {(provided: DroppableProvided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-1"
                    >
                      {(section.children || []).map((child, index) => (
                        <Draggable
                          key={child.uid}
                          draggableId={child.uid}
                          index={index}
                        >
                          {(dragProvided: DraggableProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              style={dragProvided.draggableProps.style}
                              className="flex items-center justify-between rounded bg-gray-50 p-2 hover:bg-gray-100"
                            >
                              <div
                                {...dragProvided.dragHandleProps}
                                className="pr-2"
                              >
                                <Icon
                                  icon="drag-handle-vertical"
                                  className="cursor-grab"
                                />
                              </div>

                              <span className="flex-grow">{child.text}</span>
                              <Button
                                icon="trash"
                                minimal
                                small
                                intent="danger"
                                onClick={() => void removeChild(section, child)}
                                title="Remove child"
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}

              {(!section.children || section.children.length === 0) && (
                <div className="text-sm italic text-gray-400">
                  No children added yet
                </div>
              )}
            </div>
          </Collapse>
        )}
      </div>
    );
  },
);

SectionItem.displayName = "SectionItem";

const LeftSidebarPersonalSectionsContent = ({
  leftSidebar,
}: {
  leftSidebar: RoamBasicNode;
}) => {
  const [sections, setSections] = useState<LeftSidebarPersonalSectionConfig[]>(
    [],
  );
  const [personalSectionUid, setPersonalSectionUid] = useState<string | null>(
    null,
  );
  const [newSectionInput, setNewSectionInput] = useState("");
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [settingsDialogSectionUid, setSettingsDialogSectionUid] = useState<
    string | null
  >(null);

  useEffect(() => {
    const initialize = async () => {
      const userUid = window.roamAlphaAPI.user.uid();
      const personalSectionText = userUid + "/Personal-Section";

      const personalSection = leftSidebar.children.find(
        (n) => n.text === personalSectionText,
      );

      if (!personalSection) {
        const newSectionUid = await createBlock({
          parentUid: leftSidebar.uid,
          order: 0,
          node: {
            text: personalSectionText,
          },
        });
        setPersonalSectionUid(newSectionUid);
        setSections([]);
      } else {
        setPersonalSectionUid(personalSection.uid);
        const loadedSections = getLeftSidebarPersonalSectionConfig(
          leftSidebar.children,
        ).sections;
        setSections(loadedSections);
      }
    };

    void initialize();
  }, [leftSidebar]);

  const addSection = useCallback(
    async (sectionName: string) => {
      if (!sectionName || !personalSectionUid) return;
      if (sections.some((s) => s.text === sectionName)) return;

      try {
        const newBlock = await createBlock({
          parentUid: personalSectionUid,
          order: "last",
          node: { text: sectionName },
        });

        setSections((prev) => [
          ...prev,
          {
            text: sectionName,
            uid: newBlock,
            settings: undefined,
            children: undefined,
            childrenUid: undefined,
          } as LeftSidebarPersonalSectionConfig,
        ]);

        setNewSectionInput("");
        setAutocompleteKey((prev) => prev + 1);
        refreshAndNotify();
      } catch (error) {
        renderToast({
          content: "Failed to add section",
          intent: "danger",
          id: "add-section-error",
        });
      }
    },
    [personalSectionUid, sections],
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, type } = result;
      if (!destination) return;

      if (type === "SECTIONS") {
        if (destination.index === source.index) return;

        const newSections = Array.from(sections);
        const [removed] = newSections.splice(source.index, 1);
        newSections.splice(destination.index, 0, removed);
        setSections(newSections);

        const finalIndex =
          destination.index > source.index
            ? destination.index + 1
            : destination.index;
        void window.roamAlphaAPI
          .moveBlock({
            location: { "parent-uid": personalSectionUid!, order: finalIndex },
            block: { uid: removed.uid },
          })
          .then(() => {
            refreshAndNotify();
          });
        return;
      }

      if (type === "ITEMS") {
        if (source.droppableId !== destination.droppableId) {
          return;
        }
        if (destination.index === source.index) return;

        const sectionToReorder = sections.find(
          (s) => s.uid === source.droppableId,
        );
        if (!sectionToReorder || !sectionToReorder.children) return;

        const newChildren = Array.from(sectionToReorder.children);
        const [removed] = newChildren.splice(source.index, 1);
        newChildren.splice(destination.index, 0, removed);

        const newSections = sections.map((s) => {
          if (s.uid === source.droppableId) {
            return { ...s, children: newChildren };
          }
          return s;
        });
        setSections(newSections);

        const finalIndex =
          destination.index > source.index
            ? destination.index + 1
            : destination.index;
        void window.roamAlphaAPI
          .moveBlock({
            location: {
              "parent-uid": sectionToReorder.childrenUid!,
              order: finalIndex,
            },
            block: { uid: removed.uid },
          })
          .then(() => {
            refreshAndNotify();
          });
      }
    },
    [sections, personalSectionUid, setSections],
  );

  const handleNewSectionInputChange = useCallback((value: string) => {
    setNewSectionInput(value);
  }, []);

  const activeDialogSection = useMemo(() => {
    return sections.find((s) => s.uid === settingsDialogSectionUid) || null;
  }, [sections, settingsDialogSectionUid]);

  const pageNames = useMemo(() => getAllPageNames(), []);

  if (!personalSectionUid) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="mb-2">
        <div className="mb-2 text-sm text-gray-600">
          Add pages or create custom sections with settings and children
        </div>
        <div
          className="flex items-center gap-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && newSectionInput) {
              e.preventDefault();
              e.stopPropagation();
              void addSection(newSectionInput);
            }
          }}
        >
          <InputGroup
            key={autocompleteKey}
            value={newSectionInput}
            onChange={(e) => handleNewSectionInputChange(e.target.value)}
            placeholder="Add section …"
          />
          <Button
            icon="plus"
            small
            minimal
            disabled={
              !newSectionInput ||
              sections.some((s) => s.text === newSectionInput)
            }
            onClick={() => void addSection(newSectionInput)}
          />
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable
          droppableId="personal-sections"
          type="SECTIONS"
          renderClone={(
            provided: DraggableProvided,
            _: DraggableStateSnapshot,
            rubric: DraggableRubric,
          ) => {
            const section = sections[rubric.source.index];
            return (
              <div
                ref={provided.innerRef}
                {...provided.draggableProps}
                style={provided.draggableProps.style}
              >
                <SectionItem
                  section={section}
                  setSettingsDialogSectionUid={setSettingsDialogSectionUid}
                  pageNames={pageNames}
                  setSections={setSections}
                  dragHandleProps={provided.dragHandleProps}
                />
              </div>
            );
          }}
        >
          {(provided: DroppableProvided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="mt-2 space-y-2"
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
                      style={dragProvided.draggableProps.style}
                    >
                      <SectionItem
                        section={section}
                        setSettingsDialogSectionUid={
                          setSettingsDialogSectionUid
                        }
                        pageNames={pageNames}
                        setSections={setSections}
                        dragHandleProps={dragProvided.dragHandleProps}
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

      {activeDialogSection && activeDialogSection.settings && (
        <Dialog
          isOpen={true}
          onClose={() => setSettingsDialogSectionUid(null)}
          title={`Settings for "${activeDialogSection.text}"`}
          style={{ width: "500px" }}
        >
          <div className="space-y-4 p-4">
            <div className="space-y-3">
              <NumberPanel
                title="Truncate-result?"
                description="Maximum characters to display"
                order={1}
                uid={activeDialogSection.settings.truncateResult?.uid}
                parentUid={activeDialogSection.settings.uid}
                value={activeDialogSection.settings.truncateResult?.value}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export const LeftSidebarPersonalSections = () => {
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

  return <LeftSidebarPersonalSectionsContent leftSidebar={leftSidebar} />;
};
