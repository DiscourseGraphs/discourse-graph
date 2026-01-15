import React, { useCallback, useMemo, useState, memo } from "react";
import { Button, ButtonGroup, Collapse } from "@blueprintjs/core";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { extractRef } from "roamjs-components/util";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import {
  getGlobalSetting,
  setGlobalSetting,
} from "~/components/settings/utils/accessors";
import { LeftSidebarGlobalSettingsSchema } from "~/components/settings/utils/zodSchema";
import { GlobalFlagPanel } from "./components/BlockPropSettingPanels";

type PageData = {
  uid: string;
  text: string;
};

const PageItem = memo(
  ({
    page,
    index,
    isFirst,
    isLast,
    onMove,
    onRemove,
  }: {
    page: PageData;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onMove: (index: number, direction: "up" | "down") => void;
    onRemove: (page: PageData) => void;
  }) => {
    const pageDisplayTitle =
      getPageTitleByPageUid(page.text) ||
      getTextByBlockUid(extractRef(page.text)) ||
      page.text;

    return (
      <div className="group flex items-center justify-between rounded bg-gray-50 p-2 hover:bg-gray-100">
        <div className="mr-2 min-w-0 flex-1 truncate">{pageDisplayTitle}</div>
        <ButtonGroup minimal className="flex-shrink-0">
          <Button
            icon="arrow-up"
            small
            disabled={isFirst}
            onClick={() => onMove(index, "up")}
            title="Move up"
            className="opacity-0 transition-opacity group-hover:opacity-100"
          />
          <Button
            icon="arrow-down"
            small
            disabled={isLast}
            onClick={() => onMove(index, "down")}
            title="Move down"
            className="opacity-0 transition-opacity group-hover:opacity-100"
          />
          <Button
            icon="trash"
            small
            intent="danger"
            onClick={() => onRemove(page)}
            title="Remove page"
          />
        </ButtonGroup>
      </div>
    );
  },
);

PageItem.displayName = "PageItem";

const LeftSidebarGlobalSectionsContent = () => {
  const [pages, setPages] = useState<PageData[]>(() => {
    const leftSidebarSettings = LeftSidebarGlobalSettingsSchema.parse(
      getGlobalSetting(["Left Sidebar"]) ?? {},
    );
    return (leftSidebarSettings.Children || []).map((uid: string) => ({
      uid,
      text: uid,
    }));
  });
  const [newPageInput, setNewPageInput] = useState("");
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [isExpanded, setIsExpanded] = useState(true);

  const pageNames = useMemo(() => getAllPageNames(), []);

  const updateChildren = useCallback((newChildren: string[]) => {
    setGlobalSetting(["Left Sidebar", "Children"], newChildren);
  }, []);

  const movePage = useCallback(
    (index: number, direction: "up" | "down") => {
      if (direction === "up" && index === 0) return;
      if (direction === "down" && index === pages.length - 1) return;

      const newPages = [...pages];
      const [removed] = newPages.splice(index, 1);
      const newIndex = direction === "up" ? index - 1 : index + 1;
      newPages.splice(newIndex, 0, removed);

      setPages(newPages);
      updateChildren(newPages.map((p) => p.text));
    },
    [pages, updateChildren],
  );

  const addPage = useCallback(
    (pageName: string) => {
      if (!pageName) return;

      const targetUid = getPageUidByPageTitle(pageName);
      if (!targetUid) {
        renderToast({
          content: `Page "${pageName}" not found`,
          intent: "warning",
          id: "page-not-found",
        });
        return;
      }

      if (pages.some((p) => p.text === targetUid)) {
        console.warn(`Page "${pageName}" already exists in global section`);
        return;
      }

      const newPage: PageData = {
        uid: targetUid,
        text: targetUid,
      };

      const nextPages = [...pages, newPage];
      setPages(nextPages);
      updateChildren(nextPages.map((p) => p.text));
      setNewPageInput("");
      setAutocompleteKey((prev) => prev + 1);
    },
    [pages, updateChildren],
  );

  const removePage = useCallback(
    (page: PageData) => {
      const nextPages = pages.filter((p) => p.uid !== page.uid);
      setPages(nextPages);
      updateChildren(nextPages.map((p) => p.text));
    },
    [pages, updateChildren],
  );

  const handlePageInputChange = useCallback((value: string) => {
    setNewPageInput(value);
  }, []);

  const toggleChildren = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const isAddButtonDisabled = useMemo(() => {
    if (!newPageInput) return true;
    const targetUid = getPageUidByPageTitle(newPageInput);
    return !targetUid || pages.some((p) => p.text === targetUid);
  }, [newPageInput, pages]);

  return (
    <div className="flex flex-col gap-4 p-1">
      <div
        className="global-section-settings rounded-md p-3 hover:bg-gray-50"
        style={{
          border: "1px solid rgba(51, 51, 51, 0.2)",
        }}
      >
        <GlobalFlagPanel
          title="Folded"
          description="If children are present, start with global section collapsed in left sidebar"
          settingKeys={["Left Sidebar", "Settings", "Folded"]}
          disabled={!pages.length}
        />
        <GlobalFlagPanel
          title="Collapsable"
          description="Make global section collapsable"
          settingKeys={["Left Sidebar", "Settings", "Collapsable"]}
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
            <div className="mb-3 flex items-center gap-2">
              <AutocompleteInput
                key={autocompleteKey}
                value={newPageInput}
                setValue={handlePageInputChange}
                placeholder="Add page…"
                options={pageNames}
                maxItemsDisplayed={50}
                autoFocus
                onConfirm={() => addPage(newPageInput)}
              />
              <Button
                icon="plus"
                small
                minimal
                disabled={isAddButtonDisabled}
                onClick={() => addPage(newPageInput)}
                title="Add page"
              />
            </div>
            {pages.length > 0 ? (
              <div className="space-y-1">
                {pages.map((page, index) => (
                  <PageItem
                    key={page.uid}
                    page={page}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === pages.length - 1}
                    onMove={movePage}
                    onRemove={removePage}
                  />
                ))}
              </div>
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
  return <LeftSidebarGlobalSectionsContent />;
};
