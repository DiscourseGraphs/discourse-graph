import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import refreshConfigTree from "~/utils/refreshConfigTree";
import React, { useCallback, useEffect, useState } from "react";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { Button, Tag } from "@blueprintjs/core";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import type { RoamBasicNode } from "roamjs-components/types";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";

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

export const LeftSidebarPersonalSections = () => {};
