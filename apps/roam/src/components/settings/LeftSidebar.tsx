import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import React, { useCallback, useEffect, useState } from "react";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { Button, Dialog, Collapse } from "@blueprintjs/core";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import type { RoamBasicNode } from "roamjs-components/types";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import NumberPanel from "roamjs-components/components/ConfigPanels/NumberPanel";
import type { LeftSidebarPersonalSectionConfig } from "~/utils/getLeftSidebarSettings";

export const LeftSidebarGlobalSections = () => {
  const [settings, setSettings] = useState(getFormattedConfigTree());
  const { leftSidebar } = settings;

  const globalSection = leftSidebar.global;
  const parentUid = globalSection.uid;

  const [pages, setPages] = useState(globalSection.children);
  const [newPageInputs, setNewPageInputs] = useState<Record<string, string>>(
    {},
  );
  const [autocompleteKeys, setAutocompleteKeys] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    const ensureSettings = async () => {
      const configTree = getBasicTreeByParentUid(
        getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
      );
      let sidebarNode = configTree.find((n) => n.text === "Left Sidebar");

      if (!sidebarNode) {
        const newSidebarUid = await createBlock({
          parentUid: getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
          node: {
            text: "Left Sidebar",
            children: [
              {
                text: "Global Section",
                children: [{ text: "Children" }],
              },
              {
                text: "Personal Section",
              },
            ],
          },
        });
        sidebarNode = {
          uid: newSidebarUid,
          text: "Left Sidebar",
          children: [],
        };
      }
      refreshConfigTree();
      setSettings(getFormattedConfigTree());
    };
    ensureSettings();
  }, []);

  useEffect(() => {
    setPages(globalSection.children);
  }, [globalSection.children]);

  const refreshPages = useCallback(() => {
    refreshConfigTree();
    const newConfig = getFormattedConfigTree();
    setSettings(newConfig);
    setPages(newConfig.leftSidebar.global.children);
  }, []);

  const addPage = async (page: string) => {
    if (!page || pages.some((p) => p.text === page)) {
      return;
    }
    try {
      await createBlock({
        parentUid: globalSection.childrenUid,
        order: "last",
        node: { text: page },
      });
      refreshPages();
      setNewPageInputs((prev) => ({
        ...prev,
        [globalSection.childrenUid]: "",
      }));
      setAutocompleteKeys((prev) => ({
        ...prev,
        [globalSection.childrenUid]: (prev[globalSection.childrenUid] || 0) + 1,
      }));
    } catch (error) {
      console.error("Failed to add page:", error);
    }
  };

  const removePage = useCallback(
    async (page: RoamBasicNode) => {
      try {
        await deleteBlock(page.uid);
        refreshPages();
      } catch (error) {
        console.error("Failed to remove page:", error);
      }
    },
    [refreshPages],
  );

  const getPageInput = () => newPageInputs[globalSection.childrenUid] || "";
  const setPageInput = useCallback(
    (value: string) => {
      setTimeout(() => {
        setNewPageInputs((prev) => ({
          ...prev,
          [globalSection.childrenUid]: value,
        }));
      }, 0);
    },
    [globalSection.childrenUid],
  );
  const getAutocompleteKey = () =>
    autocompleteKeys[globalSection.childrenUid] || 0;

  return (
    <div className="flex flex-col gap-4 p-1">
      <FlagPanel
        title="Open"
        description="Open the left sidebar by default"
        order={0}
        uid={globalSection.open.uid}
        parentUid={parentUid}
        value={globalSection.open.value || false}
      />
      <div
        className="flex items-center gap-2"
        onKeyDown={(e) => {
          if (e.key === "Enter" && getPageInput()) {
            e.preventDefault();
            e.stopPropagation();
            addPage(getPageInput());
          }
        }}
      >
        <AutocompleteInput
          key={getAutocompleteKey()}
          value={getPageInput()}
          setValue={setPageInput}
          placeholder="Add page…"
          options={getAllPageNames()}
          maxItemsDisplayed={50}
        />
        <Button
          icon="plus"
          small
          minimal
          disabled={
            !getPageInput() || pages.some((p) => p.text === getPageInput())
          }
          onClick={() => void addPage(getPageInput())}
        />
      </div>
      <div className="mt-2 flex flex-col gap-1">
        {pages.map((p) => (
          <div
            key={p.uid}
            className="flex items-center justify-between rounded-sm p-1 hover:bg-gray-100"
          >
            <span>{p.text}</span>
            <Button
              icon="trash"
              minimal
              small
              onClick={() => void removePage(p)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export const LeftSidebarPersonalSections = () => {
  const [settings, setSettings] = useState(getFormattedConfigTree());
  const { leftSidebar } = settings;
  const personalSection = leftSidebar.personal;

  const [sections, setSections] = useState<LeftSidebarPersonalSectionConfig[]>(
    personalSection.sections || [],
  );
  const [newSectionInput, setNewSectionInput] = useState("");
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [sectionChildInputs, setSectionChildInputs] = useState<
    Record<string, string>
  >({});
  const [childAutocompleteKeys, setChildAutocompleteKeys] = useState<
    Record<string, number>
  >({});
  const [settingsDialogSectionUid, setSettingsDialogSectionUid] = useState<
    string | null
  >(null);
  const [expandedChildLists, setExpandedChildLists] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    const ensureSettings = async () => {
      const configTree = getBasicTreeByParentUid(
        getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
      );
      let sidebarNode = configTree.find((n) => n.text === "Left Sidebar");

      if (!sidebarNode) {
        await createBlock({
          parentUid: getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
          node: {
            text: "Left Sidebar",
            children: [
              {
                text: "Global Section",
                children: [{ text: "Children" }],
              },
              {
                text: "Personal Section",
              },
            ],
          },
        });
      } else {
        const hasPersonalSection = sidebarNode.children?.some(
          (n) => n.text === "Personal Section",
        );

        if (!hasPersonalSection) {
          await createBlock({
            parentUid: sidebarNode.uid,
            node: { text: "Personal Section" },
          });
        }
      }

      refreshConfigTree();
      setSettings(getFormattedConfigTree());
    };
    ensureSettings();
  }, []);

  useEffect(() => {
    setSections(personalSection.sections || []);
  }, [personalSection.sections]);

  const refreshSections = useCallback(() => {
    refreshConfigTree();
    const newConfig = getFormattedConfigTree();
    setSettings(newConfig);
    setSections(newConfig.leftSidebar.personal.sections || []);
  }, []);

  const addSection = async (sectionName: string) => {
    if (!sectionName || sections.some((s) => s.text === sectionName)) {
      return;
    }

    try {
      await createBlock({
        parentUid: personalSection.uid,
        order: "last",
        node: { text: sectionName },
      });
      refreshSections();
      setNewSectionInput("");
      setAutocompleteKey((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to add section:", error);
    }
  };

  const removeSection = useCallback(
    async (section: LeftSidebarPersonalSectionConfig) => {
      try {
        await deleteBlock(section.uid);
        refreshSections();
      } catch (error) {
        console.error("Failed to remove section:", error);
      }
    },
    [refreshSections],
  );

  const toggleChildrenList = (sectionUid: string) => {
    setExpandedChildLists((prev) => {
      const next = new Set(prev);
      if (next.has(sectionUid)) next.delete(sectionUid);
      else next.add(sectionUid);
      return next;
    });
  };

  const convertToComplexSection = async (
    section: LeftSidebarPersonalSectionConfig,
  ) => {
    try {
      await createBlock({
        parentUid: section.uid,
        order: 0,
        node: {
          text: "Settings",
          children: [
            { text: "Collapsable?", children: [{ text: "true" }] },
            { text: "Open?", children: [{ text: "true" }] },
            { text: "Truncate-result?", children: [{ text: "75" }] },
          ],
        },
      });

      await createBlock({
        parentUid: section.uid,
        order: 1,
        node: { text: "Children" },
      });

      refreshSections();
      setSettingsDialogSectionUid(section.uid);
    } catch (error) {
      console.error("Failed to convert to complex section:", error);
    }
  };

  const addChildToSection = async (
    childrenUid: string,
    childName: string,
  ) => {
    if (!childName) return;

    try {
      await createBlock({
        parentUid: childrenUid,
        order: "last",
        node: { text: childName },
      });
      refreshSections();
      setSectionChildInputs((prev) => ({ ...prev, [childrenUid]: "" }));
      setChildAutocompleteKeys((prev) => ({
        ...prev,
        [childrenUid]: (prev[childrenUid] || 0) + 1,
      }));
    } catch (error) {
      console.error("Failed to add child:", error);
    }
  };

  const removeChild = async (child: RoamBasicNode) => {
    try {
      await deleteBlock(child.uid);
      refreshSections();
    } catch (error) {
      console.error("Failed to remove child:", error);
    }
  };

  const renderSectionSettings = (section: LeftSidebarPersonalSectionConfig) => {
    if (section.isSimple || !section.settings) return null;

    return (
      <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
        <FlagPanel
          title="Collapsable?"
          description="Allow section to be collapsed"
          order={1}
          uid={section.settings.collapsable.uid}
          parentUid={section.uid}
          value={section.settings.collapsable.value}
        />
        <FlagPanel
          title="Open?"
          description="Open by default"
          order={2}
          uid={section.settings.open.uid}
          parentUid={section.uid}
          value={section.settings.open.value}
        />
        <NumberPanel
          title="Truncate-result?"
          description="Maximum characters to display"
          order={3}
          uid={section.settings.truncateResult.uid}
          parentUid={section.uid}
          value={section.settings.truncateResult.value}
        />
      </div>
    );
  };

  const renderSectionChildren = (section: LeftSidebarPersonalSectionConfig) => {
    if (section.isSimple || !section.children) return null;

    const inputKey = section.childrenUid!;
    const childInput = sectionChildInputs[inputKey] || "";
    const setChildInput = (value: string) => {
      setTimeout(() => {
        setSectionChildInputs((prev) => ({ ...prev, [inputKey]: value }));
      }, 0);
    };

    return (
      <div className="ml-4 mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
        <div className="text-sm font-semibold text-gray-600">
          Children Pages
        </div>
        <div
          className="flex items-center gap-2"
          onKeyDown={(e) => {
            if (e.key === "Enter" && childInput) {
              e.preventDefault();
              e.stopPropagation();
              addChildToSection(section.childrenUid!, childInput);
            }
          }}
        >
          <AutocompleteInput
            key={childAutocompleteKeys[inputKey] || 0}
            value={childInput}
            setValue={setChildInput}
            placeholder="Add child page…"
            options={getAllPageNames()}
            maxItemsDisplayed={50}
          />
          <Button
            icon="plus"
            small
            minimal
            disabled={!childInput}
            onClick={() =>
              addChildToSection(section.childrenUid!, childInput)
            }
          />
        </div>
        <div className="space-y-1">
          {(section.children || []).map((child) => (
            <div
              key={child.uid}
              className="flex items-center justify-between rounded p-1 hover:bg-gray-50"
            >
              <span className="text-sm">{child.text}</span>
              <Button
                icon="trash"
                minimal
                small
                onClick={() => removeChild(child)}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const activeDialogSection =
    sections.find((s) => s.uid === settingsDialogSectionUid) || null;

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
              addSection(newSectionInput);
            }
          }}
        >
          <AutocompleteInput
            key={autocompleteKey}
            value={newSectionInput}
            setValue={setNewSectionInput}
            placeholder="Add section or page…"
            options={getAllPageNames()}
            maxItemsDisplayed={50}
          />
          <Button
            icon="plus"
            small
            minimal
            disabled={
              !newSectionInput ||
              sections.some((s) => s.text === newSectionInput)
            }
            onClick={() => addSection(newSectionInput)}
          />
        </div>
      </div>

      <div className="mt-2 space-y-2">
        {sections.map((section) => (
          <div
            key={section.uid}
            className="rounded-md border p-2 hover:bg-gray-50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium">{section.text}</span>
                {section.isSimple && (
                  <span className="text-xs text-gray-500">
                    (simple reference)
                  </span>
                )}
              </div>
              <div>
                {section.isSimple ? (
                  <Button
                    icon="settings"
                    small
                    minimal
                    title="Convert to section with settings"
                    onClick={() => convertToComplexSection(section)}
                  />
                ) : (
                  <Button
                    icon="settings"
                    small
                    minimal
                    title="Edit section settings"
                    onClick={() => setSettingsDialogSectionUid(section.uid)}
                  />
                )}
                <Button
                  icon="trash"
                  minimal
                  small
                  onClick={() => removeSection(section)}
                />
              </div>
            </div>

            {!section.isSimple && (section.children?.length || 0) > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between">
                  <Button
                    icon={
                      expandedChildLists.has(section.uid)
                        ? "chevron-down"
                        : "chevron-right"
                    }
                    minimal
                    small
                    onClick={() => toggleChildrenList(section.uid)}
                  >
                    Children ({section.children?.length || 0})
                  </Button>
                  <Button
                    icon="edit"
                    minimal
                    small
                    onClick={() => setSettingsDialogSectionUid(section.uid)}
                    title="Manage children"
                  />
                </div>
                <Collapse isOpen={expandedChildLists.has(section.uid)}>
                  <div className="mt-1 space-y-1 pl-2">
                    {(section.children || []).map((child) => (
                      <div
                        key={child.uid}
                        className="flex items-center justify-between rounded p-1 hover:bg-gray-50"
                      >
                        <span className="text-sm">{child.text}</span>
                      </div>
                    ))}
                  </div>
                </Collapse>
              </div>
            )}
          </div>
        ))}
      </div>

      {activeDialogSection && (
        <Dialog
          isOpen={true}
          onClose={() => setSettingsDialogSectionUid(null)}
          title={`Edit "${activeDialogSection.text}"`}
        >
          <div className="space-y-4 p-4">
            {renderSectionSettings(activeDialogSection)}
            {renderSectionChildren(activeDialogSection)}
          </div>
        </Dialog>
      )}
    </div>
  );
};
