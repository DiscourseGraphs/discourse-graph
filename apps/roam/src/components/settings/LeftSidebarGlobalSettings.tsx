import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import { Button, ButtonGroup } from "@blueprintjs/core";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import type { RoamBasicNode } from "roamjs-components/types";
import { extractRef } from "roamjs-components/util";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import { getGlobalSetting, setGlobalSetting } from "~/utils/Settings/accessors";
import { GlobalSettingsSchema } from "~/utils/Settings/zodSchema";
import { FlagPanel } from "./block-prop/FlagPanel";
import { TOP_LEVEL_BLOCK_PROP_KEYS } from "~/data/blockPropsSettingsConfig";
import { CollapsiblePanel } from "./block-prop/CollapsiblePanel";

const PageItem = memo(
  ({
    page,
    index,
    isFirst,
    isLast,
    onMove,
    onRemove,
  }: {
    page: RoamBasicNode;
    index: number;
    isFirst: boolean;
    isLast: boolean;
    onMove: (index: number, direction: "up" | "down") => void;
    onRemove: (page: RoamBasicNode) => void;
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
  const [pages, setPages] = useState<RoamBasicNode[]>([]);
  const [newPageInput, setNewPageInput] = useState("");
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  const pageNames = useMemo(() => getAllPageNames(), []);

  useEffect(() => {
    setIsInitializing(true);

    const leftSidebarSettings = GlobalSettingsSchema.shape[
      "Left Sidebar"
    ].parse(getGlobalSetting(["Left Sidebar"]) || {});

    setPages(
      (leftSidebarSettings.Children || []).map((uid) => ({
        uid,
        text: uid,
        children: [],
      })),
    );
    setIsInitializing(false);
  }, []);

  const movePage = useCallback(
    (index: number, direction: "up" | "down") => {
      if (direction === "up" && index === 0) return;
      if (direction === "down" && index === pages.length - 1) return;

      const newPages = [...pages];
      const [removed] = newPages.splice(index, 1);
      const newIndex = direction === "up" ? index - 1 : index + 1;
      newPages.splice(newIndex, 0, removed);
      void setGlobalSetting(
        ["Left Sidebar", "Children"],
        newPages.map((p) => p.text),
      );
      setPages(newPages);
    },
    [pages],
  );

  const addPage = useCallback(
    (pageName: string) => {
      if (!pageName) return;

      const targetUid = getPageUidByPageTitle(pageName);
      if (pages.some((p) => p.text === targetUid)) {
        console.warn(`Page "${pageName}" already exists in global section`);
        return;
      }

      try {
        const newPage: RoamBasicNode = {
          text: targetUid,
          uid: targetUid,
          children: [],
        };

        const nextPages = [...pages, newPage];
        void setGlobalSetting(
          ["Left Sidebar", "Children"],
          [...nextPages.map((p) => p.text)],
        );
        setPages(nextPages);
        setNewPageInput("");
        setAutocompleteKey((prev) => prev + 1);
      } catch (error) {
        renderToast({
          content: "Failed to add page",
          intent: "danger",
          id: "add-page-error",
        });
      }
    },
    [pages],
  );

  const removePage = useCallback(
    (page: RoamBasicNode) => {
      const next = pages.filter((p) => p.uid !== page.uid);
      void setGlobalSetting(
        ["Left Sidebar", "Children"],
        next.map((p) => p.text),
      );
      setPages(next);
    },
    [pages],
  );

  const handlePageInputChange = useCallback((value: string) => {
    setNewPageInput(value);
  }, []);

  const isAddButtonDisabled = useMemo(() => {
    if (!newPageInput) return true;
    const targetUid = getPageUidByPageTitle(newPageInput);
    return !targetUid || pages.some((p) => p.text === targetUid);
  }, [newPageInput, pages]);

  if (isInitializing) {
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
        <div className="flex flex-col gap-2">
          <FlagPanel
            title="Folded"
            description="If children are present, start with global section collapsed in left sidebar"
            flag={[
              TOP_LEVEL_BLOCK_PROP_KEYS.global,
              "Left Sidebar",
              "Settings",
              "Folded",
            ]}
            disabled={!pages.length}
          />
          <FlagPanel
            title="Collapsable"
            description="Make global section collapsable"
            flag={[
              TOP_LEVEL_BLOCK_PROP_KEYS.global,
              "Left Sidebar",
              "Settings",
              "Collapsable",
            ]}
          />
        </div>
      </div>

      <CollapsiblePanel
        header={
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Children</span>
            <span className="text-sm text-gray-500">
              {pages.length} {pages.length === 1 ? "page" : "pages"}
            </span>
          </div>
        }
        defaultOpen={true}
      >
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
              onConfirm={() => void addPage(newPageInput)}
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
            <div className="space-y-1">
              {pages.map((page, index) => (
                <PageItem
                  key={page.uid}
                  page={page}
                  index={index}
                  isFirst={index === 0}
                  isLast={index === pages.length - 1}
                  onMove={movePage}
                  onRemove={() => void removePage(page)}
                />
              ))}
            </div>
          ) : (
            <div className="text-sm italic text-gray-400">
              No pages added yet
            </div>
          )}
        </div>
      </CollapsiblePanel>
    </div>
  );
};

export const LeftSidebarGlobalSections = () => {
  return <LeftSidebarGlobalSectionsContent />;
};
