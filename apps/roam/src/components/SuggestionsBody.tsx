import React, { useMemo, useState, useEffect } from "react";
import {
  Button,
  ControlGroup,
  Intent,
  Menu,
  MenuItem,
  Position,
  Popover,
  Spinner,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { Result } from "roamjs-components/types/query-builder";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";

type SuggestedNode = Result & { type: string };
type SuggestionsCache = {
  selectedPages: string[];
  useAllPagesForSuggestions: boolean;
};
const suggestionsCache = new Map<string, SuggestionsCache>();

const PageSelectionControls = ({
  currentPageInput,
  setCurrentPageInput,
  selectedPages,
  setSelectedPages,
  allPages,
  autocompleteKey,
  setAutocompleteKey,
  setUseAllPagesForSuggestions,
  pageGroups,
}: {
  currentPageInput: string;
  setCurrentPageInput: (value: string) => void;
  selectedPages: string[];
  setSelectedPages: React.Dispatch<React.SetStateAction<string[]>>;
  allPages: string[];
  autocompleteKey: number;
  setAutocompleteKey: React.Dispatch<React.SetStateAction<number>>;
  setUseAllPagesForSuggestions: (value: boolean) => void;
  pageGroups: Record<string, string[]>;
}) => {
  const handleAddPage = () => {
    if (currentPageInput && !selectedPages.includes(currentPageInput)) {
      setSelectedPages((prev) => [...prev, currentPageInput]);
      setTimeout(() => {
        setCurrentPageInput("");
        setAutocompleteKey((prev) => prev + 1);
      }, 0);
      setUseAllPagesForSuggestions(false);
    }
  };

  return (
    <div className="mt-2">
      <label
        htmlFor="suggest-page-input"
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        Suggest relationships from pages
      </label>
      <ControlGroup fill className="flex flex-wrap items-center gap-2">
        <div
          className="flex-0 min-w-[160px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && currentPageInput) {
              e.preventDefault();
              e.stopPropagation();
              handleAddPage();
            }
          }}
        >
          <AutocompleteInput
            key={autocompleteKey}
            value={currentPageInput}
            placeholder={"Add page…"}
            setValue={setCurrentPageInput}
            options={allPages}
            maxItemsDisplayed={50}
          />
        </div>
        <Tooltip
          content={
            selectedPages.includes(currentPageInput)
              ? "Page already added"
              : "Add page"
          }
          disabled={!currentPageInput}
        >
          <Button
            icon="plus"
            small
            onClick={handleAddPage}
            disabled={
              !currentPageInput || selectedPages.includes(currentPageInput)
            }
            className="whitespace-nowrap"
          />
        </Tooltip>
        {Object.keys(pageGroups).length > 0 && (
          <Popover
            position={Position.BOTTOM_LEFT}
            content={
              <Menu>
                {Object.keys(pageGroups)
                  .sort((a, b) => a.localeCompare(b))
                  .map((groupName) => (
                    <MenuItem
                      key={groupName}
                      text={groupName}
                      shouldDismissPopover={false}
                      onClick={() => {
                        const groupPages = pageGroups[groupName] || [];
                        setSelectedPages((prev) =>
                          Array.from(new Set([...prev, ...groupPages])),
                        );
                        setUseAllPagesForSuggestions(false);
                      }}
                    />
                  ))}
              </Menu>
            }
          >
            <Tooltip content="Add pages from a group">
              <Button icon="folder-open" small text="Add Group" />
            </Tooltip>
          </Popover>
        )}
        <Button
          text="Find"
          icon="search-template"
          intent={Intent.PRIMARY}
          onClick={() => {
            setUseAllPagesForSuggestions(false);
          }}
          disabled={selectedPages.length === 0}
          small
          className="whitespace-nowrap"
        />
        <div>
          <Tooltip content={"Use all pages"}>
            <Button
              text="All Pages"
              icon="globe-network"
              small
              onClick={() => {
                setUseAllPagesForSuggestions(true);
                setSelectedPages([]);
                setCurrentPageInput("");
                setAutocompleteKey((prev) => prev + 1);
              }}
              className="whitespace-nowrap"
            />
          </Tooltip>
        </div>
      </ControlGroup>
      {selectedPages.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedPages.map((p) => (
            <Tag
              key={p}
              onRemove={() => {
                setSelectedPages((prev) => prev.filter((x) => x !== p));
              }}
              round
              minimal
            >
              {p}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
};

const TypeFilterPopover = ({
  availableFilterTypes,
  activeNodeTypeFilters,
  setActiveNodeTypeFilters,
}: {
  availableFilterTypes: { uid: string; text: string }[];
  activeNodeTypeFilters: string[];
  setActiveNodeTypeFilters: React.Dispatch<React.SetStateAction<string[]>>;
}) => (
  <Popover
    position={Position.BOTTOM_RIGHT}
    content={
      <div className="space-y-1 p-2">
        {availableFilterTypes.map((t) => (
          <Button
            key={t.uid}
            small
            minimal
            fill
            alignText="left"
            text={t.text}
            intent={
              activeNodeTypeFilters.includes(t.uid)
                ? Intent.PRIMARY
                : Intent.NONE
            }
            onClick={() => {
              setActiveNodeTypeFilters((prev) =>
                prev.includes(t.uid)
                  ? prev.filter((f) => f !== t.uid)
                  : [...prev, t.uid],
              );
            }}
            className="w-full justify-start whitespace-nowrap"
          />
        ))}
        {activeNodeTypeFilters.length > 0 && (
          <Button
            small
            minimal
            icon="cross"
            text="Clear"
            onClick={() => setActiveNodeTypeFilters([])}
            className="whitespace-nowrap text-xs"
          />
        )}
      </div>
    }
  >
    <Button
      icon="filter"
      small
      minimal
      intent={activeNodeTypeFilters.length > 0 ? Intent.PRIMARY : Intent.NONE}
    />
  </Popover>
);

const SuggestionsList = ({
  actuallyDisplayedNodes,
  isSearching,
  searchResults,
  activeNodeTypeFilters,
  onCreateBlock,
  toggleOverlayHighlight,
}: {
  actuallyDisplayedNodes: SuggestedNode[];
  isSearching: boolean;
  searchResults: SuggestedNode[];
  activeNodeTypeFilters: string[];
  onCreateBlock: (node: SuggestedNode) => void;
  toggleOverlayHighlight: (nodeUid: string, on: boolean) => void;
}) => (
  <div className="flex pr-2">
    <div className="flex-grow overflow-y-auto">
      {isSearching && <Spinner size={Spinner.SIZE_SMALL} className="mb-2" />}
      <ul className="list-none space-y-1 p-0">
        {!isSearching &&
          actuallyDisplayedNodes.length > 0 &&
          actuallyDisplayedNodes.map((node) => (
            <li
              key={node.uid}
              className="flex items-center justify-between rounded-md px-1.5 py-1.5 hover:bg-gray-100"
              onMouseEnter={() => toggleOverlayHighlight(node.uid, true)}
              onMouseLeave={() => toggleOverlayHighlight(node.uid, false)}
            >
              <span
                className="mr-2 cursor-pointer hover:underline"
                onClick={(e) => {
                  if (e.shiftKey) {
                    openBlockInSidebar(node.uid);
                  } else {
                    window.roamAlphaAPI.ui.mainWindow.openPage({
                      page: { uid: node.uid },
                    });
                  }
                }}
              >
                {node.text}
              </span>
              <Button
                minimal
                small
                icon="add"
                onClick={() => onCreateBlock(node)}
                className="ml-2 whitespace-nowrap"
              />
            </li>
          ))}
        {!isSearching && actuallyDisplayedNodes.length === 0 && (
          <li className="px-2 py-1.5 italic text-gray-500">
            {searchResults.length > 0 && activeNodeTypeFilters.length > 0
              ? "No suggestions match the current filters."
              : "No relevant relations found."}
          </li>
        )}
      </ul>
    </div>
  </div>
);

type Props = {
  tag: string;
  blockUid: string;
  existingResults: Result[];
  loading?: boolean;
};

const SuggestionsBody: React.FC<Props> = ({
  tag,
  blockUid,
  existingResults,
  loading = false,
}) => {
  const allPages = useMemo(() => getAllPageNames(), []);
  const cachedState = suggestionsCache.get(blockUid);
  const extensionAPI = useExtensionAPI();

  const [currentPageInput, setCurrentPageInput] = useState("");
  const [selectedPages, setSelectedPages] = useState<string[]>(
    cachedState?.selectedPages || [],
  );
  const [useAllPagesForSuggestions, setUseAllPagesForSuggestions] = useState(
    cachedState?.useAllPagesForSuggestions || false,
  );
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [pageGroups, setPageGroups] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const storedGroups = extensionAPI?.settings.get(
      "suggestion-page-groups",
    ) as Record<string, string[]> | undefined;
    if (storedGroups && typeof storedGroups === "object") {
      setPageGroups(storedGroups);
    }
  }, [extensionAPI]);

  useEffect(() => {
    suggestionsCache.set(blockUid, {
      selectedPages,
      useAllPagesForSuggestions,
    });
  }, [blockUid, selectedPages, useAllPagesForSuggestions]);

  return (
    <div onMouseDown={(e) => e.stopPropagation()}>
      {loading && (
        <div className="flex items-center justify-center py-4">
          <Spinner size={16} />
          <span className="ml-2 text-sm text-gray-600">
            Loading suggestions...
          </span>
        </div>
      )}
      <PageSelectionControls
        currentPageInput={currentPageInput}
        setCurrentPageInput={setCurrentPageInput}
        selectedPages={selectedPages}
        setSelectedPages={setSelectedPages}
        allPages={allPages}
        autocompleteKey={autocompleteKey}
        setAutocompleteKey={setAutocompleteKey}
        setUseAllPagesForSuggestions={setUseAllPagesForSuggestions}
        pageGroups={pageGroups}
      />

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-base font-semibold">
            {useAllPagesForSuggestions
              ? "From All Pages"
              : selectedPages.length > 0
                ? `From ${selectedPages.length === 1 ? `"${selectedPages[0]}"` : `${selectedPages.length} selected pages`}`
                : "Select pages to see suggestions"}
          </h3>
        </div>
        <div className="flex pr-2">
          <div className="flex-grow overflow-y-auto">
            <div className="px-2 py-4 text-center italic text-gray-500">
              Search functionality coming soon...
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuggestionsBody;
