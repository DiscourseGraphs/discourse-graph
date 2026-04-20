import discourseConfigRef from "~/utils/discourseConfigRef";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import {
  Button,
  ButtonGroup,
  Collapse,
  Dialog,
  InputGroup,
} from "@blueprintjs/core";
import { arrayMove } from "@dnd-kit/sortable";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import type { RoamBasicNode } from "roamjs-components/types";
import { setPersonalSetting } from "~/components/settings/utils/accessors";
import {
  PersonalNumberPanel,
  PersonalTextPanel,
} from "~/components/settings/components/BlockPropSettingPanels";
import {
  LeftSidebarPersonalSectionConfig,
  getLeftSidebarPersonalSectionConfig,
  PersonalSectionChild,
} from "~/utils/getLeftSidebarSettings";
import { extractRef, getSubTree } from "roamjs-components/util";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import { render as renderToast } from "roamjs-components/components/Toast";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { refreshAndNotify } from "~/components/LeftSidebarView";
import { SortableList, type SortableHandle } from "~/components/SortableList";
import { moveRoamBlockToIndex } from "~/utils/moveRoamBlock";
import { memo, Dispatch, SetStateAction } from "react";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import posthog from "posthog-js";

/* eslint-disable @typescript-eslint/naming-convention */
export const sectionsToBlockProps = (
  sections: LeftSidebarPersonalSectionConfig[],
) =>
  sections.map((s) => ({
    name: s.text,
    Children: (s.children || []).map((c) => ({
      uid: c.text,
      Alias: c.alias?.value || "",
    })),
    Settings: {
      "Truncate-result?": s.settings?.truncateResult?.value ?? 75,
      Folded: s.settings?.folded?.value ?? false,
    },
  }));
/* eslint-enable @typescript-eslint/naming-convention */

const syncAllSectionsToBlockProps = (
  sections: LeftSidebarPersonalSectionConfig[],
) => {
  setPersonalSetting(["Left sidebar"], sectionsToBlockProps(sections));
};

const SectionItem = memo(
  ({
    section,
    setSettingsDialogSectionUid,
    pageNames,
    setSections,
    sectionsRef,
    dragHandle,
    initiallyExpanded,
  }: {
    section: LeftSidebarPersonalSectionConfig;
    setSections: Dispatch<SetStateAction<LeftSidebarPersonalSectionConfig[]>>;
    sectionsRef: React.MutableRefObject<LeftSidebarPersonalSectionConfig[]>;
    setSettingsDialogSectionUid: (uid: string | null) => void;
    pageNames: string[];
    dragHandle: SortableHandle;
    initiallyExpanded?: boolean;
  }) => {
    const ref = extractRef(section.text);
    const blockText = getTextByBlockUid(ref);
    const originalName = blockText || section.text;
    const [childInput, setChildInput] = useState("");
    const [childInputKey, setChildInputKey] = useState(0);

    const [expandedChildLists, setExpandedChildLists] = useState<Set<string>>(
      new Set(initiallyExpanded ? [section.uid] : []),
    );
    const isExpanded = expandedChildLists.has(section.uid);
    const [childSettingsUid, setChildSettingsUid] = useState<string | null>(
      null,
    );
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

          syncAllSectionsToBlockProps(
            sectionsRef.current.map((s) =>
              s.uid === section.uid
                ? {
                    ...s,
                    settings: {
                      uid: settingsUid,
                      folded: { uid: foldedUid, value: false },
                      truncateResult: { uid: truncateSettingUid, value: 75 },
                    },
                    children: [],
                  }
                : s,
            ),
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
      [setSections, sectionsRef],
    );

    const removeSection = useCallback(
      async (section: LeftSidebarPersonalSectionConfig) => {
        try {
          await deleteBlock(section.uid);

          const updatedSections = sectionsRef.current.filter(
            (s) => s.uid !== section.uid,
          );
          setSections(updatedSections);
          syncAllSectionsToBlockProps(updatedSections);
          refreshAndNotify();
        } catch (error) {
          renderToast({
            content: "Failed to remove section",
            intent: "danger",
            id: "remove-section-error",
          });
        }
      },
      [setSections, sectionsRef],
    );

    const addChildToSection = useCallback(
      async (
        section: LeftSidebarPersonalSectionConfig,
        childrenUid: string,
        childName: string,
      ) => {
        if (!childName || !childrenUid) return;

        const targetUid = getPageUidByPageTitle(childName) || childName.trim();

        try {
          const newChild = await createBlock({
            parentUid: childrenUid,
            order: "last",
            node: { text: targetUid },
          });

          const updatedSections = sectionsRef.current.map((s) => {
            if (s.uid === section.uid) {
              return {
                ...s,
                children: [
                  ...(s.children || []),
                  {
                    text: targetUid,
                    uid: newChild,
                    children: [],
                    alias: { value: "" },
                  },
                ],
              };
            }
            return s;
          });
          setSections(updatedSections);
          syncAllSectionsToBlockProps(updatedSections);
          refreshAndNotify();
        } catch (error) {
          renderToast({
            content: "Failed to add child",
            intent: "danger",
            id: "add-child-error",
          });
        }
      },
      [setSections, sectionsRef],
    );
    const removeChild = useCallback(
      async (
        section: LeftSidebarPersonalSectionConfig,
        child: PersonalSectionChild,
      ) => {
        try {
          await deleteBlock(child.uid);

          const updatedSections = sectionsRef.current.map((s) => {
            if (s.uid === section.uid) {
              return {
                ...s,
                children: s.children?.filter((c) => c.uid !== child.uid),
              };
            }
            return s;
          });
          setSections(updatedSections);
          syncAllSectionsToBlockProps(updatedSections);
          refreshAndNotify();
        } catch (error) {
          renderToast({
            content: "Failed to remove child",
            intent: "danger",
            id: "remove-child-error",
          });
        }
      },
      [setSections, sectionsRef],
    );

    const reorderChildren = useCallback(
      ({
        section,
        oldIndex,
        newIndex,
      }: {
        section: LeftSidebarPersonalSectionConfig;
        oldIndex: number;
        newIndex: number;
      }) => {
        const children = section.children;
        if (!children || !section.childrenUid) return;
        const moved = children[oldIndex];
        if (!moved) return;

        const newChildren = arrayMove(children, oldIndex, newIndex);
        const updatedSections = sectionsRef.current.map((s) =>
          s.uid === section.uid ? { ...s, children: newChildren } : s,
        );
        setSections(updatedSections);
        syncAllSectionsToBlockProps(updatedSections);

        void moveRoamBlockToIndex({
          blockUid: moved.uid,
          parentUid: section.childrenUid,
          sourceIndex: oldIndex,
          destIndex: newIndex,
        }).then(() => {
          refreshAndNotify();
        });
      },
      [setSections, sectionsRef],
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
        <div
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          className="group flex cursor-grab items-center active:cursor-grabbing"
        >
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
            onClick={() =>
              !sectionWithoutSettingsAndChildren &&
              toggleChildrenList(section.uid)
            }
          >
            <span className="font-medium">{originalName}</span>
          </div>
          <ButtonGroup minimal>
            <Button
              icon={sectionWithoutSettingsAndChildren ? "plus" : "settings"}
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
              intent="danger"
              onClick={() => void removeSection(section)}
              title="Remove section"
            />
          </ButtonGroup>
        </div>

        {!sectionWithoutSettingsAndChildren && (
          <Collapse isOpen={isExpanded}>
            <div className="ml-6 mt-3">
              <div className="mb-2 flex items-center gap-2">
                <AutocompleteInput
                  key={childInputKey}
                  value={childInput}
                  setValue={setChildInput}
                  placeholder="Add child page…"
                  options={pageNames}
                  maxItemsDisplayed={50}
                  autoFocus
                  onConfirm={() => void handleAddChild()}
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
                <SortableList
                  items={section.children || []}
                  getId={(c) => c.uid}
                  onReorder={(oldIndex, newIndex) =>
                    reorderChildren({ section, oldIndex, newIndex })
                  }
                  className="space-y-1"
                  renderItem={(child, handle) => {
                    const childAlias = child.alias?.value;
                    const isSettingsOpen = childSettingsUid === child.uid;
                    const childDisplayTitle =
                      getPageTitleByPageUid(child.text) ||
                      getTextByBlockUid(extractRef(child.text)) ||
                      child.text;
                    return (
                      <>
                        <div
                          {...handle.attributes}
                          {...handle.listeners}
                          className="group flex cursor-grab items-center justify-between rounded bg-gray-50 p-2 hover:bg-gray-100 active:cursor-grabbing"
                        >
                          <div
                            className="mr-2 min-w-0 flex-1 truncate"
                            title={childDisplayTitle}
                          >
                            {childAlias ? (
                              <span>
                                <span className="font-medium">
                                  {childAlias}
                                </span>
                                <span className="ml-2 text-xs text-gray-400">
                                  ({childDisplayTitle})
                                </span>
                              </span>
                            ) : (
                              childDisplayTitle
                            )}
                          </div>
                          <ButtonGroup minimal className="flex-shrink-0">
                            <Button
                              icon="settings"
                              small
                              onClick={() => setChildSettingsUid(child.uid)}
                              title="Child settings"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            />
                            <Button
                              icon="trash"
                              small
                              intent="danger"
                              onClick={() => void removeChild(section, child)}
                              title="Remove child"
                            />
                          </ButtonGroup>
                        </div>
                        <Dialog
                          isOpen={isSettingsOpen}
                          onClose={() => {
                            setChildSettingsUid(null);
                            refreshAndNotify();
                          }}
                          title={`Settings for "${childDisplayTitle}"`}
                          style={{ width: "400px" }}
                        >
                          <div className="p-4">
                            <PersonalTextPanel
                              title="Alias"
                              description="Display name for this item"
                              settingKeys={["Left sidebar"]}
                              initialValue={child.alias?.value ?? ""}
                              order={0}
                              uid={child.alias?.uid}
                              parentUid={child.uid}
                              setter={(_keys, value) => {
                                const updatedSections = sectionsRef.current.map(
                                  (s) =>
                                    s.uid === section.uid
                                      ? {
                                          ...s,
                                          children: s.children?.map((c) =>
                                            c.uid === child.uid
                                              ? {
                                                  ...c,
                                                  alias: {
                                                    ...c.alias,
                                                    value,
                                                  },
                                                }
                                              : c,
                                          ),
                                        }
                                      : s,
                                );
                                setSections(updatedSections);
                                syncAllSectionsToBlockProps(updatedSections);
                              }}
                            />
                          </div>
                        </Dialog>
                      </>
                    );
                  }}
                />
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
  expandedSectionUid,
}: {
  leftSidebar: RoamBasicNode;
  expandedSectionUid?: string;
}) => {
  const [sections, setSections] = useState<LeftSidebarPersonalSectionConfig[]>(
    [],
  );
  const [personalSectionUid, setPersonalSectionUid] = useState<string | null>(
    null,
  );
  const [newSectionInput, setNewSectionInput] = useState("");
  const [settingsDialogSectionUid, setSettingsDialogSectionUid] = useState<
    string | null
  >(null);
  const sectionTitleUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

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
      if (sectionsRef.current.some((s) => s.text === sectionName)) return;

      try {
        const newBlock = await createBlock({
          parentUid: personalSectionUid,
          order: "last",
          node: { text: sectionName },
        });

        const newSection = {
          text: sectionName,
          uid: newBlock,
          settings: undefined,
          children: undefined,
          childrenUid: undefined,
        } as LeftSidebarPersonalSectionConfig;
        const updatedSections = [...sectionsRef.current, newSection];
        setSections(updatedSections);
        syncAllSectionsToBlockProps(updatedSections);

        posthog.capture("Left Sidebar Personal Settings: Section Added", {
          sectionName,
        });
        setNewSectionInput("");
        refreshAndNotify();
      } catch (error) {
        renderToast({
          content: "Failed to add section",
          intent: "danger",
          id: "add-section-error",
        });
      }
    },
    [personalSectionUid],
  );

  const handleNewSectionInputChange = useCallback((value: string) => {
    setNewSectionInput(value);
  }, []);

  const reorderSections = useCallback(
    (oldIndex: number, newIndex: number) => {
      const moved = sections[oldIndex];
      if (!moved || !personalSectionUid) return;

      const newSections = arrayMove(sections, oldIndex, newIndex);
      setSections(newSections);
      syncAllSectionsToBlockProps(newSections);

      void moveRoamBlockToIndex({
        blockUid: moved.uid,
        parentUid: personalSectionUid,
        sourceIndex: oldIndex,
        destIndex: newIndex,
      }).then(() => {
        refreshAndNotify();
      });
    },
    [sections, personalSectionUid],
  );

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
        <div className="flex items-center gap-2">
          <InputGroup
            value={newSectionInput}
            onChange={(e) => handleNewSectionInputChange(e.target.value)}
            placeholder="Add section …"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSectionInput) {
                e.preventDefault();
                e.stopPropagation();
                void addSection(newSectionInput);
              }
            }}
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

      <SortableList
        items={sections}
        getId={(s) => s.uid}
        onReorder={reorderSections}
        className="mt-2 space-y-2"
        renderItem={(section, handle) => (
          <SectionItem
            section={section}
            setSettingsDialogSectionUid={setSettingsDialogSectionUid}
            pageNames={pageNames}
            setSections={setSections}
            sectionsRef={sectionsRef}
            dragHandle={handle}
            initiallyExpanded={section.uid === expandedSectionUid}
          />
        )}
      />

      {activeDialogSection && activeDialogSection.settings && (
        <Dialog
          isOpen={true}
          onClose={() => {
            setSettingsDialogSectionUid(null);
          }}
          title={`Settings for "${activeDialogSection.text}"`}
          style={{ width: "500px" }}
        >
          <div className="space-y-4 p-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1 flex items-center text-sm font-medium">
                  Section title
                  <span
                    className="bp3-icon bp3-icon-info-sign ml-1"
                    title="Display name for this section"
                  />
                </label>
                <InputGroup
                  value={activeDialogSection.text}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    const sectionUid = activeDialogSection.uid;
                    setSections((prev) =>
                      prev.map((s) =>
                        s.uid === sectionUid ? { ...s, text: nextValue } : s,
                      ),
                    );
                    clearTimeout(sectionTitleUpdateTimeoutRef.current);
                    sectionTitleUpdateTimeoutRef.current = setTimeout(() => {
                      void updateBlock({
                        uid: sectionUid,
                        text: nextValue,
                      }).then(() => {
                        refreshAndNotify();
                      });
                      syncAllSectionsToBlockProps(sectionsRef.current);
                    }, 300);
                  }}
                />
              </div>
              <PersonalNumberPanel
                title="Truncate-result?"
                description="Maximum characters to display"
                settingKeys={["Left sidebar"]}
                initialValue={
                  activeDialogSection.settings.truncateResult?.value ?? 75
                }
                order={1}
                uid={activeDialogSection.settings.truncateResult?.uid}
                parentUid={activeDialogSection.settings.uid || ""}
                setter={(_keys, value) => {
                  const updatedSections = sectionsRef.current.map((s) =>
                    s.uid === activeDialogSection.uid
                      ? {
                          ...s,
                          settings: s.settings
                            ? {
                                ...s.settings,
                                truncateResult: {
                                  ...s.settings.truncateResult,
                                  value,
                                },
                              }
                            : s.settings,
                        }
                      : s,
                  );
                  setSections(updatedSections);
                  syncAllSectionsToBlockProps(updatedSections);
                }}
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export const LeftSidebarPersonalSections = ({
  expandedSectionUid,
}: {
  expandedSectionUid?: string;
}) => {
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

  return (
    <LeftSidebarPersonalSectionsContent
      leftSidebar={leftSidebar}
      expandedSectionUid={expandedSectionUid}
    />
  );
};
