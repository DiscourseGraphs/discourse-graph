import React, {
  useCallback,
  useMemo,
  useState,
  memo,
} from "react";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import {
  Button,
  ButtonGroup,
  Collapse,
  Dialog,
  InputGroup,
  NumericInput,
  Label,
} from "@blueprintjs/core";
import { extractRef } from "roamjs-components/util";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import {
  getPersonalSetting,
  setPersonalSetting,
} from "~/components/settings/utils/accessors";
import {
  LeftSidebarPersonalSettingsSchema,
  type LeftSidebarPersonalSettings,
  type PersonalSection,
} from "~/components/settings/utils/zodSchema";

type ChildData = {
  Page: string;
  Alias: string;
};

type SectionData = {
  name: string;
  Children: ChildData[];
  Settings: {
    "Truncate-result?": number;
    Folded: boolean;
  };
};

const SectionItem = memo(
  ({
    section,
    index,
    isFirst,
    isLast,
    pageNames,
    onUpdateSection,
    onRemoveSection,
    onMoveSection,
    onOpenSettings,
  }: {
    section: SectionData;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    pageNames: string[];
    onUpdateSection: (name: string, updates: Partial<PersonalSection>) => void;
    onRemoveSection: (name: string) => void;
    onMoveSection: (index: number, direction: "up" | "down") => void;
    onOpenSettings: (name: string) => void;
  }) => {
    const [childInput, setChildInput] = useState("");
    const [childInputKey, setChildInputKey] = useState(0);
    const [isExpanded, setIsExpanded] = useState(false);
    const [childSettingsIndex, setChildSettingsIndex] = useState<number | null>(null);

    const hasChildren = section.Children.length > 0;

    const addChild = useCallback(
      (childName: string) => {
        if (!childName) return;
        const targetUid = getPageUidByPageTitle(childName) || childName.trim();

        if (section.Children.some((c) => c.Page === targetUid)) {
          return;
        }

        const newChildren = [...section.Children, { Page: targetUid, Alias: "" }];
        onUpdateSection(section.name, { Children: newChildren });
        setChildInput("");
        setChildInputKey((prev) => prev + 1);
      },
      [section, onUpdateSection],
    );

    const removeChild = useCallback(
      (childIndex: number) => {
        const newChildren = section.Children.filter((_, i) => i !== childIndex);
        onUpdateSection(section.name, { Children: newChildren });
      },
      [section, onUpdateSection],
    );

    const moveChild = useCallback(
      (childIndex: number, direction: "up" | "down") => {
        if (direction === "up" && childIndex === 0) return;
        if (direction === "down" && childIndex === section.Children.length - 1) return;

        const newChildren = [...section.Children];
        const [removed] = newChildren.splice(childIndex, 1);
        const newIndex = direction === "up" ? childIndex - 1 : childIndex + 1;
        newChildren.splice(newIndex, 0, removed);
        onUpdateSection(section.name, { Children: newChildren });
      },
      [section, onUpdateSection],
    );

    const updateChildAlias = useCallback(
      (childIndex: number, alias: string) => {
        const newChildren = section.Children.map((c, i) =>
          i === childIndex ? { ...c, Alias: alias } : c,
        );
        onUpdateSection(section.name, { Children: newChildren });
      },
      [section, onUpdateSection],
    );

    const activeChild = childSettingsIndex !== null ? section.Children[childSettingsIndex] : null;

    return (
      <div
        className="personal-section rounded-md p-3 hover:bg-gray-50"
        style={{ border: "1px solid rgba(51, 51, 51, 0.2)" }}
      >
        <div className="group flex items-center">
          {hasChildren && (
            <Button
              icon={isExpanded ? "chevron-down" : "chevron-right"}
              minimal
              small
              onClick={() => setIsExpanded(!isExpanded)}
            />
          )}
          <div
            className="flex-1 truncate"
            style={{ cursor: hasChildren ? "pointer" : "default" }}
            onClick={() => hasChildren && setIsExpanded(!isExpanded)}
          >
            <span className="font-medium">{section.name}</span>
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
              icon="settings"
              title="Edit section settings"
              onClick={() => onOpenSettings(section.name)}
            />
            <Button
              icon="trash"
              intent="danger"
              onClick={() => onRemoveSection(section.name)}
              title="Remove section"
            />
          </ButtonGroup>
        </div>

        <Collapse isOpen={isExpanded || !hasChildren}>
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
                onConfirm={() => addChild(childInput)}
              />
              <Button
                icon="plus"
                small
                minimal
                disabled={!childInput}
                onClick={() => addChild(childInput)}
                title="Add child"
              />
            </div>

            {section.Children.length > 0 ? (
              <div className="space-y-1">
                {section.Children.map((child, childIndex) => {
                  const childDisplayTitle =
                    getPageTitleByPageUid(child.Page) ||
                    getTextByBlockUid(extractRef(child.Page)) ||
                    child.Page;
                  return (
                    <div key={`${child.Page}-${childIndex}`}>
                      <div className="group flex items-center justify-between rounded bg-gray-50 p-2 hover:bg-gray-100">
                        <div className="mr-2 min-w-0 flex-1 truncate" title={childDisplayTitle}>
                          {child.Alias ? (
                            <span>
                              <span className="font-medium">{child.Alias}</span>
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
                            onClick={() => moveChild(childIndex, "up")}
                            title="Move child up"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                          <Button
                            icon="arrow-down"
                            small
                            disabled={childIndex === section.Children.length - 1}
                            onClick={() => moveChild(childIndex, "down")}
                            title="Move child down"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                          <Button
                            icon="trash"
                            small
                            intent="danger"
                            onClick={() => removeChild(childIndex)}
                            title="Remove child"
                          />
                        </ButtonGroup>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm italic text-gray-400">No children added yet</div>
            )}
          </div>
        </Collapse>

        {activeChild && childSettingsIndex !== null && (
          <Dialog
            isOpen={true}
            onClose={() => setChildSettingsIndex(null)}
            title={`Settings for "${getPageTitleByPageUid(activeChild.Page) || activeChild.Page}"`}
            style={{ width: "400px" }}
          >
            <div className="p-4">
              <Label>
                Alias
                <InputGroup
                  value={activeChild.Alias}
                  onChange={(e) => updateChildAlias(childSettingsIndex, e.target.value)}
                  placeholder="Display name for this item"
                />
              </Label>
            </div>
          </Dialog>
        )}
      </div>
    );
  },
);

SectionItem.displayName = "SectionItem";

const LeftSidebarPersonalSectionsContent = () => {
  const [sections, setSections] = useState<SectionData[]>(() => {
    const raw = getPersonalSetting<LeftSidebarPersonalSettings>(["Left Sidebar"]);
    const parsed = LeftSidebarPersonalSettingsSchema.parse(raw ?? {});
    return Object.entries(parsed).map(([name, data]) => ({
      name,
      Children: data.Children,
      Settings: data.Settings,
    }));
  });
  const [newSectionInput, setNewSectionInput] = useState("");
  const [settingsDialogSection, setSettingsDialogSection] = useState<string | null>(null);

  const pageNames = useMemo(() => getAllPageNames(), []);

  const saveToBlockProps = useCallback((newSections: SectionData[]) => {
    const record: LeftSidebarPersonalSettings = {};
    for (const section of newSections) {
      record[section.name] = {
        Children: section.Children,
        Settings: section.Settings,
      };
    }
    setPersonalSetting(["Left Sidebar"], record);
  }, []);

  const addSection = useCallback(
    (sectionName: string) => {
      if (!sectionName) return;
      if (sections.some((s) => s.name === sectionName)) return;

      const newSection: SectionData = {
        name: sectionName,
        Children: [],
        Settings: { "Truncate-result?": 75, Folded: false },
      };
      const newSections = [...sections, newSection];
      setSections(newSections);
      saveToBlockProps(newSections);
      setNewSectionInput("");
    },
    [sections, saveToBlockProps],
  );

  const removeSection = useCallback(
    (sectionName: string) => {
      const newSections = sections.filter((s) => s.name !== sectionName);
      setSections(newSections);
      saveToBlockProps(newSections);
    },
    [sections, saveToBlockProps],
  );

  const updateSection = useCallback(
    (sectionName: string, updates: Partial<PersonalSection>) => {
      const newSections = sections.map((s) =>
        s.name === sectionName
          ? {
              ...s,
              Children: updates.Children ?? s.Children,
              Settings: updates.Settings ?? s.Settings,
            }
          : s,
      );
      setSections(newSections);
      saveToBlockProps(newSections);
    },
    [sections, saveToBlockProps],
  );

  const moveSection = useCallback(
    (index: number, direction: "up" | "down") => {
      if (direction === "up" && index === 0) return;
      if (direction === "down" && index === sections.length - 1) return;

      const newSections = [...sections];
      const [removed] = newSections.splice(index, 1);
      const newIndex = direction === "up" ? index - 1 : index + 1;
      newSections.splice(newIndex, 0, removed);
      setSections(newSections);
      saveToBlockProps(newSections);
    },
    [sections, saveToBlockProps],
  );

  const renameSection = useCallback(
    (oldName: string, newName: string) => {
      if (!newName || newName === oldName) return;
      if (sections.some((s) => s.name === newName)) return;

      const newSections = sections.map((s) =>
        s.name === oldName ? { ...s, name: newName } : s,
      );
      setSections(newSections);
      saveToBlockProps(newSections);
    },
    [sections, saveToBlockProps],
  );

  const updateSectionSettings = useCallback(
    (sectionName: string, settings: Partial<PersonalSection["Settings"]>) => {
      const section = sections.find((s) => s.name === sectionName);
      if (!section) return;

      const newSettings = { ...section.Settings, ...settings };
      updateSection(sectionName, { Settings: newSettings });
    },
    [sections, updateSection],
  );

  const activeSection = settingsDialogSection
    ? sections.find((s) => s.name === settingsDialogSection)
    : null;

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
            disabled={!newSectionInput || sections.some((s) => s.name === newSectionInput)}
            onClick={() => addSection(newSectionInput)}
          />
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {sections.map((section, index) => (
          <SectionItem
            key={section.name}
            section={section}
            index={index}
            isFirst={index === 0}
            isLast={index === sections.length - 1}
            pageNames={pageNames}
            onUpdateSection={updateSection}
            onRemoveSection={removeSection}
            onMoveSection={moveSection}
            onOpenSettings={setSettingsDialogSection}
          />
        ))}
      </div>

      {activeSection && (
        <Dialog
          isOpen={true}
          onClose={() => setSettingsDialogSection(null)}
          title={`Settings for "${activeSection.name}"`}
          style={{ width: "500px" }}
        >
          <div className="space-y-4 p-4">
            <div className="space-y-3">
              <Label>
                Section Title
                <InputGroup
                  value={activeSection.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    if (newName && newName !== activeSection.name) {
                      renameSection(activeSection.name, newName);
                      setSettingsDialogSection(newName);
                    }
                  }}
                />
              </Label>
              <Label>
                Truncate Result
                <NumericInput
                  value={activeSection.Settings["Truncate-result?"]}
                  onValueChange={(value) =>
                    updateSectionSettings(activeSection.name, { "Truncate-result?": value })
                  }
                  min={0}
                  fill
                />
              </Label>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export const LeftSidebarPersonalSections = () => {
  return <LeftSidebarPersonalSectionsContent />;
};
