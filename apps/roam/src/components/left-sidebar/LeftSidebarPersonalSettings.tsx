import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  memo,
  Dispatch,
  SetStateAction,
} from "react";
import {
  Button,
  ButtonGroup,
  Dialog,
  InputGroup,
  NumericInput,
} from "@blueprintjs/core";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { extractRef } from "roamjs-components/util";
import { render as renderToast } from "roamjs-components/components/Toast";
import {
  getPersonalSetting,
  setPersonalSetting,
} from "~/components/settings/block-prop/utils/accessors";
import type { PersonalSection } from "~/components/settings/block-prop/utils/zodSchema";
import { PersonalSettingsSchema } from "~/components/settings/block-prop/utils/zodSchema";
import { FlagPanel } from "../settings/block-prop/components/FlagPanel";
import { CollapsiblePanel } from "../settings/block-prop/components/CollapsiblePanel";
import { getPersonalSettingsKey } from "~/components/settings/block-prop/utils/init";

type SectionEntry = {
  name: string;
  data: PersonalSection;
};

type ChildEntry = PersonalSection["Children"][number];

const SectionItem = memo(
  ({
    section,
    sections,
    setSettingsDialogSectionName,
    pageNames,
    setSections,
    index,
    isFirst,
    isLast,
    onMoveSection,
  }: {
    section: SectionEntry;
    sections: SectionEntry[];
    setSections: Dispatch<SetStateAction<SectionEntry[]>>;
    setSettingsDialogSectionName: (name: string | null) => void;
    pageNames: string[];
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onMoveSection: (index: number, direction: "up" | "down") => void;
  }) => {
    const ref = extractRef(section.name);
    const blockText = getTextByBlockUid(ref);
    const originalName = blockText || section.name;
    const [childInput, setChildInput] = useState("");
    const [childInputKey, setChildInputKey] = useState(0);
    const [childSettingsIndex, setChildSettingsIndex] = useState<number | null>(
      null,
    );

    const removeSection = useCallback(
      (sectionName: string) => {
        const updated = sections.filter((s) => s.name !== sectionName);
        const newRecord: Record<string, PersonalSection> = {};
        updated.forEach((s) => {
          newRecord[s.name] = s.data;
        });
        setPersonalSetting(["Left Sidebar"], newRecord);
        setSections(updated);
      },
      [sections, setSections],
    );

    const addChildToSection = useCallback(
      (sectionName: string, childName: string) => {
        if (!childName) return;

        const targetPage =
          getPageUidByPageTitle(childName) || childName.trim();
        const newChild: ChildEntry = {
          Page: targetPage,
          Alias: "",
        };

        const updated = sections.map((s) => {
          if (s.name === sectionName) {
            return {
              ...s,
              data: {
                ...s.data,
                Children: [...s.data.Children, newChild],
              },
            };
          }
          return s;
        });

        const newRecord: Record<string, PersonalSection> = {};
        updated.forEach((s) => {
          newRecord[s.name] = s.data;
        });
        setPersonalSetting(["Left Sidebar"], newRecord);
        setSections(updated);
      },
      [sections, setSections],
    );

    const removeChild = useCallback(
      (sectionName: string, childIndex: number) => {
        const updated = sections.map((s) => {
          if (s.name === sectionName) {
            return {
              ...s,
              data: {
                ...s.data,
                Children: s.data.Children.filter((_, i) => i !== childIndex),
              },
            };
          }
          return s;
        });

        const newRecord: Record<string, PersonalSection> = {};
        updated.forEach((s) => {
          newRecord[s.name] = s.data;
        });
        setPersonalSetting(["Left Sidebar"], newRecord);
        setSections(updated);
      },
      [sections, setSections],
    );

    const moveChild = useCallback(
      (sectionName: string, childIndex: number, direction: "up" | "down") => {
        const currentSection = sections.find((s) => s.name === sectionName);
        if (!currentSection) return;

        const children = [...currentSection.data.Children];
        if (direction === "up" && childIndex === 0) return;
        if (direction === "down" && childIndex === children.length - 1) return;

        const newIndex = direction === "up" ? childIndex - 1 : childIndex + 1;
        const [removed] = children.splice(childIndex, 1);
        children.splice(newIndex, 0, removed);

        const updated = sections.map((s) => {
          if (s.name === sectionName) {
            return {
              ...s,
              data: {
                ...s.data,
                Children: children,
              },
            };
          }
          return s;
        });

        const newRecord: Record<string, PersonalSection> = {};
        updated.forEach((s) => {
          newRecord[s.name] = s.data;
        });
        setPersonalSetting(["Left Sidebar"], newRecord);
        setSections(updated);
      },
      [sections, setSections],
    );

    const updateChildAlias = useCallback(
      (sectionName: string, childIndex: number, alias: string) => {
        const updated = sections.map((s) => {
          if (s.name === sectionName) {
            const children = [...s.data.Children];
            children[childIndex] = { ...children[childIndex], Alias: alias };
            return {
              ...s,
              data: {
                ...s.data,
                Children: children,
              },
            };
          }
          return s;
        });

        const newRecord: Record<string, PersonalSection> = {};
        updated.forEach((s) => {
          newRecord[s.name] = s.data;
        });
        setPersonalSetting(["Left Sidebar"], newRecord);
        setSections(updated);
      },
      [sections, setSections],
    );

    const handleAddChild = useCallback(() => {
      if (childInput) {
        addChildToSection(section.name, childInput);
        setChildInput("");
        setChildInputKey((prev) => prev + 1);
      }
    }, [childInput, section.name, addChildToSection]);

    return (
      <CollapsiblePanel
        header={
          <div className="group flex w-full items-center">
            <div className="flex-1 truncate">
              <span className="font-medium">{originalName}</span>
            </div>
            <ButtonGroup minimal>
              <Button
                icon="arrow-up"
                small
                disabled={isFirst}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveSection(index, "up");
                }}
                title="Move section up"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              />
              <Button
                icon="arrow-down"
                small
                disabled={isLast}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveSection(index, "down");
                }}
                title="Move section down"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              />
              <Button
                icon="settings"
                title="Edit section settings"
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsDialogSectionName(section.name);
                }}
              />
              <Button
                icon="trash"
                intent="danger"
                onClick={(e) => {
                  e.stopPropagation();
                  removeSection(section.name);
                }}
                title="Remove section"
              />
            </ButtonGroup>
          </div>
        }
        defaultOpen={!section.data.Settings.Folded}
        className="personal-section"
      >
        <div className="ml-6">
              <div className="mb-2 flex items-center gap-2">
                <AutocompleteInput
                  key={childInputKey}
                  value={childInput}
                  setValue={setChildInput}
                  placeholder="Add child page…"
                  options={pageNames}
                  maxItemsDisplayed={50}
                  autoFocus
                  onConfirm={() => handleAddChild()}
                />
                <Button
                  icon="plus"
                  small
                  minimal
                  disabled={!childInput}
                  onClick={() => handleAddChild()}
                  title="Add child"
                />
              </div>

              {section.data.Children.length > 0 && (
                <div className="space-y-1">
                  {section.data.Children.map((child, childIndex) => {
                    const childAlias = child.Alias;
                    const isSettingsOpen = childSettingsIndex === childIndex;
                    const childDisplayTitle =
                      getPageTitleByPageUid(child.Page) ||
                      getTextByBlockUid(extractRef(child.Page)) ||
                      child.Page;
                    return (
                      <div key={`${child.Page}-${childIndex}`}>
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
                              onClick={() => setChildSettingsIndex(childIndex)}
                              title="Child Settings"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            />
                            <Button
                              icon="arrow-up"
                              small
                              disabled={childIndex === 0}
                              onClick={() =>
                                moveChild(section.name, childIndex, "up")
                              }
                              title="Move child up"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            />
                            <Button
                              icon="arrow-down"
                              small
                              disabled={
                                childIndex === section.data.Children.length - 1
                              }
                              onClick={() =>
                                moveChild(section.name, childIndex, "down")
                              }
                              title="Move child down"
                              className="opacity-0 transition-opacity group-hover:opacity-100"
                            />
                            <Button
                              icon="trash"
                              small
                              intent="danger"
                              onClick={() =>
                                removeChild(section.name, childIndex)
                              }
                              title="Remove child"
                            />
                          </ButtonGroup>
                        </div>
                        <Dialog
                          isOpen={isSettingsOpen}
                          onClose={() => setChildSettingsIndex(null)}
                          title={`Settings for "${childDisplayTitle}"`}
                          style={{ width: "400px" }}
                        >
                          <div className="p-4">
                            <label className="mb-2 block text-sm font-medium">
                              Alias
                            </label>
                            <InputGroup
                              value={child.Alias}
                              onChange={(e) =>
                                updateChildAlias(
                                  section.name,
                                  childIndex,
                                  e.target.value,
                                )
                              }
                              placeholder="Display name for this item"
                            />
                          </div>
                        </Dialog>
                      </div>
                    );
                  })}
                </div>
              )}

              {section.data.Children.length === 0 && (
                <div className="text-sm italic text-gray-400">
                  No children added yet
                </div>
              )}
        </div>
      </CollapsiblePanel>
    );
  },
);

SectionItem.displayName = "SectionItem";

export const LeftSidebarPersonalSections = () => {
  const [sections, setSections] = useState<SectionEntry[]>([]);
  const [newSectionInput, setNewSectionInput] = useState("");
  const [settingsDialogSectionName, setSettingsDialogSectionName] = useState<
    string | null
  >(null);

  useEffect(() => {
    const loadSettings = () => {
      const rawSettings = getPersonalSetting(["Left Sidebar"]);
      const parsed = PersonalSettingsSchema.shape["Left Sidebar"].safeParse(
        rawSettings || {},
      );

      if (parsed.success) {
        const entries: SectionEntry[] = Object.entries(parsed.data).map(
          ([name, data]) => ({
            name,
            data,
          }),
        );
        setSections(entries);
      } else {
        console.warn("Failed to parse personal settings:", parsed.error);
        setSections([]);
      }
    };

    loadSettings();
  }, []);

  const addSection = useCallback(
    (sectionName: string) => {
      if (!sectionName) return;
      if (sections.some((s) => s.name === sectionName)) {
        renderToast({
          content: "Section already exists",
          intent: "warning",
          id: "section-exists-warning",
        });
        return;
      }

      const newSectionData: PersonalSection = {
        Children: [],
        Settings: {
          "Truncate-result?": 75,
          Folded: false,
        },
      };

      const updated = [...sections, { name: sectionName, data: newSectionData }];
      const newRecord: Record<string, PersonalSection> = {};
      updated.forEach((s) => {
        newRecord[s.name] = s.data;
      });
      setPersonalSetting(["Left Sidebar"], newRecord);
      setSections(updated);
      setNewSectionInput("");
    },
    [sections],
  );

  const moveSection = useCallback(
    (index: number, direction: "up" | "down") => {
      if (direction === "up" && index === 0) return;
      if (direction === "down" && index === sections.length - 1) return;

      const newSections = [...sections];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      const [removed] = newSections.splice(index, 1);
      newSections.splice(newIndex, 0, removed);

      const newRecord: Record<string, PersonalSection> = {};
      newSections.forEach((s) => {
        newRecord[s.name] = s.data;
      });
      setPersonalSetting(["Left Sidebar"], newRecord);
      setSections(newSections);
    },
    [sections],
  );

  const updateSectionSettings = useCallback(
    (sectionName: string, settings: Partial<PersonalSection["Settings"]>) => {
      const updated = sections.map((s) => {
        if (s.name === sectionName) {
          return {
            ...s,
            data: {
              ...s.data,
              Settings: {
                ...s.data.Settings,
                ...settings,
              },
            },
          };
        }
        return s;
      });

      const newRecord: Record<string, PersonalSection> = {};
      updated.forEach((s) => {
        newRecord[s.name] = s.data;
      });
      setPersonalSetting(["Left Sidebar"], newRecord);
      setSections(updated);
    },
    [sections],
  );

  const activeDialogSection = useMemo(() => {
    return sections.find((s) => s.name === settingsDialogSectionName) || null;
  }, [sections, settingsDialogSectionName]);

  const pageNames = useMemo(() => getAllPageNames(), []);

  return (
    <div className="flex flex-col gap-4 p-1">
      <div className="mb-2">
        <div className="mb-2 text-sm text-gray-600">
          Add pages or create custom sections with settings and children
        </div>
        <div className="flex items-center gap-2">
          <InputGroup
            value={newSectionInput}
            onChange={(e) => setNewSectionInput(e.target.value)}
            placeholder="Add section …"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newSectionInput) {
                e.preventDefault();
                e.stopPropagation();
                addSection(newSectionInput);
              }
            }}
          />
          <Button
            icon="plus"
            small
            minimal
            disabled={
              !newSectionInput ||
              sections.some((s) => s.name === newSectionInput)
            }
            onClick={() => addSection(newSectionInput)}
          />
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {sections.map((section, index) => (
          <SectionItem
            key={section.name}
            section={section}
            sections={sections}
            setSettingsDialogSectionName={setSettingsDialogSectionName}
            pageNames={pageNames}
            setSections={setSections}
            index={index}
            isFirst={index === 0}
            isLast={index === sections.length - 1}
            onMoveSection={moveSection}
          />
        ))}
      </div>

      {activeDialogSection && (
        <Dialog
          isOpen={true}
          onClose={() => setSettingsDialogSectionName(null)}
          title={`Settings for "${activeDialogSection.name}"`}
          style={{ width: "500px" }}
        >
          <div className="space-y-4 p-4">
            <div className="space-y-3">
              <FlagPanel
                title="Folded"
                description="Start with section collapsed in left sidebar"
                flag={[
                  getPersonalSettingsKey(),
                  "Left Sidebar",
                  activeDialogSection.name,
                  "Settings",
                  "Folded",
                ]}
              />
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Truncate result (characters)
                </label>
                <NumericInput
                  value={
                    activeDialogSection.data.Settings["Truncate-result?"] || 75
                  }
                  onValueChange={(value) =>
                    updateSectionSettings(activeDialogSection.name, {
                      "Truncate-result?": value,
                    })
                  }
                  min={0}
                  fill
                />
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
