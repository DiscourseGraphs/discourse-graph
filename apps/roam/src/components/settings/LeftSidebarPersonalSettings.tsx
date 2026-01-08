import discourseConfigRef from "~/utils/discourseConfigRef";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import {
  Button,
  ButtonGroup,
  Collapse,
  Dialog,
  InputGroup,
} from "@blueprintjs/core";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import type { RoamBasicNode } from "roamjs-components/types";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
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
import { memo, Dispatch, SetStateAction } from "react";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";

const SectionItem = memo(
  ({
    section,
    setSettingsDialogSectionUid,
    pageNames,
    setSections,
    index,
    isFirst,
    isLast,
    onMoveSection,
  }: {
    section: LeftSidebarPersonalSectionConfig;
    setSections: Dispatch<SetStateAction<LeftSidebarPersonalSectionConfig[]>>;
    setSettingsDialogSectionUid: (uid: string | null) => void;
    pageNames: string[];
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onMoveSection: (index: number, direction: "up" | "down") => void;
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

        const targetUid = getPageUidByPageTitle(childName) || childName.trim();

        try {
          const newChild = await createBlock({
            parentUid: childrenUid,
            order: "last",
            node: { text: targetUid },
          });

          setSections((prev) =>
            prev.map((s) => {
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
        child: PersonalSectionChild,
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

    const moveChild = useCallback(
      (
        section: LeftSidebarPersonalSectionConfig,
        index: number,
        direction: "up" | "down",
      ) => {
        if (!section.children) return;
        if (direction === "up" && index === 0) return;
        if (direction === "down" && index === section.children.length - 1)
          return;

        const newChildren = [...section.children];
        const [removed] = newChildren.splice(index, 1);
        const newIndex = direction === "up" ? index - 1 : index + 1;
        newChildren.splice(newIndex, 0, removed);

        setSections((prev) =>
          prev.map((s) => {
            if (s.uid === section.uid) {
              return {
                ...s,
                children: newChildren,
              };
            }
            return s;
          }),
        );

        if (section.childrenUid) {
          const order = direction === "down" ? newIndex + 1 : newIndex;

          void window.roamAlphaAPI
            /* eslint-disable @typescript-eslint/naming-convention */
            .moveBlock({
              location: { "parent-uid": section.childrenUid, order },
              block: { uid: removed.uid },
            })
            .then(() => {
              refreshAndNotify();
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
        <div className="group flex items-center">
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
          <ButtonGroup minimal>
            <Button
              icon="arrow-up"
              small
              disabled={isFirst}
              onClick={() => onMoveSection(index, "up")}
              title="Move section up"
              className="opacity-0 transition-opacity group-hover:opacity-100"
            />
            <Button
              icon="arrow-down"
              small
              disabled={isLast}
              onClick={() => onMoveSection(index, "down")}
              title="Move section down"
              className="opacity-0 transition-opacity group-hover:opacity-100"
            />
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
                <div className="space-y-1">
                  {(section.children || []).map((child, index) => {
                    const childAlias = child.alias?.value;
                    const isSettingsOpen = childSettingsUid === child.uid;
                    const childDisplayTitle =
                      getPageTitleByPageUid(child.text) ||
                      getTextByBlockUid(extractRef(child.text)) ||
                      child.text;
                    return (
                      <div key={child.uid}>
                        <div className="group flex items-center justify-between rounded bg-gray-50 p-2 hover:bg-gray-100">
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
                              title="Child Settings"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            />
                            <Button
                              icon="arrow-up"
                              small
                              disabled={index === 0}
                              onClick={() => moveChild(section, index, "up")}
                              title="Move child up"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            />
                            <Button
                              icon="arrow-down"
                              small
                              disabled={
                                index === (section.children || []).length - 1
                              }
                              onClick={() => moveChild(section, index, "down")}
                              title="Move child down"
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
                            <TextPanel
                              title="Alias"
                              description="Display name for this item"
                              order={0}
                              uid={child.alias?.uid}
                              parentUid={child.uid}
                              defaultValue=""
                              options={{
                                onChange: (
                                  event: React.ChangeEvent<HTMLInputElement>,
                                ) => {
                                  const nextValue = event.target.value;
                                  setSections((prev) =>
                                    prev.map((s) =>
                                      s.uid === section.uid
                                        ? {
                                            ...s,
                                            children: s.children?.map((c) =>
                                              c.uid === child.uid
                                                ? {
                                                    ...c,
                                                    alias: {
                                                      ...c.alias,
                                                      value: nextValue,
                                                    },
                                                  }
                                                : c,
                                            ),
                                          }
                                        : s,
                                    ),
                                  );
                                },
                              }}
                            />
                          </div>
                        </Dialog>
                      </div>
                    );
                  })}
                </div>
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

  const handleNewSectionInputChange = useCallback((value: string) => {
    setNewSectionInput(value);
  }, []);

  const moveSection = useCallback(
    (index: number, direction: "up" | "down") => {
      if (direction === "up" && index === 0) return;
      if (direction === "down" && index === sections.length - 1) return;

      const newSections = [...sections];
      const [removed] = newSections.splice(index, 1);
      const newIndex = direction === "up" ? index - 1 : index + 1;
      newSections.splice(newIndex, 0, removed);

      setSections(newSections);

      if (personalSectionUid) {
        const order = direction === "down" ? newIndex + 1 : newIndex;

        void window.roamAlphaAPI
          /* eslint-disable @typescript-eslint/naming-convention */
          .moveBlock({
            location: { "parent-uid": personalSectionUid, order },
            block: { uid: removed.uid },
          })
          .then(() => {
            refreshAndNotify();
          });
      }
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

      <div className="mt-2 space-y-2">
        {sections.map((section, index) => (
          <div key={section.uid}>
            <SectionItem
              section={section}
              setSettingsDialogSectionUid={setSettingsDialogSectionUid}
              pageNames={pageNames}
              setSections={setSections}
              index={index}
              isFirst={index === 0}
              isLast={index === sections.length - 1}
              onMoveSection={moveSection}
            />
          </div>
        ))}
      </div>

      {activeDialogSection && activeDialogSection.settings && (
        <Dialog
          isOpen={true}
          onClose={() => setSettingsDialogSectionUid(null)}
          title={`Settings for "${activeDialogSection.text}"`}
          style={{ width: "500px" }}
        >
          <div className="space-y-4 p-4">
            <div className="space-y-3">
              <div>
                <label className="mb-1 flex items-center text-sm font-medium">
                  Section Title
                  <span
                    className="bp3-icon bp3-icon-info-sign ml-1"
                    title="Display name for this section"
                  />
                </label>
                <InputGroup
                  value={activeDialogSection.text}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setSections((prev) =>
                      prev.map((s) =>
                        s.uid === activeDialogSection.uid
                          ? { ...s, text: nextValue }
                          : s,
                      ),
                    );
                    void updateBlock({
                      uid: activeDialogSection.uid,
                      text: nextValue,
                    }).then(() => {
                      refreshAndNotify();
                    });
                  }}
                />
              </div>
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
