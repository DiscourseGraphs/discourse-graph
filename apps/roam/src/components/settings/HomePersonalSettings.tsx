import React, { useState, useEffect, useMemo, useCallback } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Label, Checkbox, Button, Intent, Tag } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { NodeMenuTriggerComponent } from "~/components/DiscourseNodeMenu";
import {
  getOverlayHandler,
  onPageRefObserverChange,
  previewPageRefHandler,
} from "~/utils/pageRefObserverHandlers";
import {
  hideFeedbackButton,
  showFeedbackButton,
} from "~/components/BirdEatsBugs";
import { NodeSearchMenuTriggerSetting } from "../DiscourseNodeSearchMenu";
import { runFullEmbeddingProcess } from "~/utils/embeddingWorkflow";
import { getLastUpdateTimeByGraphName } from "~/utils/syncToEmbeddingDb";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import { upsertDiscourseNodes } from "~/utils/syncToEmbeddingDb";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";

const HomePersonalSettings = ({
  onloadArgs,
  onClose,
}: {
  onloadArgs: OnloadArgs;
  onClose?: () => void;
}) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const overlayHandler = getOverlayHandler(onloadArgs);

  const [splitEnabled, setSplitEnabled] = useState<boolean>(
    Boolean(extensionAPI.settings.get("suggestion-display-split-view")),
  );
  const [overlayEnabled, setOverlayEnabled] = useState<boolean>(
    Boolean(extensionAPI.settings.get("suggestion-display-overlay")),
  );
  const [inlineEnabled, setInlineEnabled] = useState<boolean>(
    Boolean(extensionAPI.settings.get("suggestion-display-inline")),
  );


  const [embeddingsUploaded, setEmbeddingsUploaded] = useState<boolean>(false);

  const [pageGroups, setPageGroups] = useState<Record<string, string[]>>(() => {
    const storedGroups = extensionAPI.settings.get("suggestion-page-groups") as
      | Record<string, string[]>
      | undefined;
    if (storedGroups && typeof storedGroups === "object") return storedGroups;

    // Migration path for legacy single list storage
    const legacy = extensionAPI.settings.get("suggestion-default-pages") as
      | string[]
      | string
      | undefined;
    if (legacy) {
      const pages = Array.isArray(legacy)
        ? legacy
        : typeof legacy === "string"
          ? [legacy]
          : [];
      const migrated = { Default: pages } as Record<string, string[]>;
      extensionAPI.settings.set("suggestion-page-groups", migrated);
      return migrated;
    }
    return {};
  });

  // UI helpers for groups
  const [newGroupName, setNewGroupName] = useState("");
  const [newPageInputs, setNewPageInputs] = useState<Record<string, string>>(
    {},
  );
  const [autocompleteKeys, setAutocompleteKeys] = useState<
    Record<string, number>
  >({});

  const allPages = useMemo(() => getAllPageNames(), []);

  const persistGroups = (updated: Record<string, string[]>) => {
    setPageGroups(updated);
    extensionAPI.settings.set("suggestion-page-groups", updated);
  };

  const addGroup = (name: string) => {
    if (!name || pageGroups[name]) return;
    const updated = { ...pageGroups, [name]: [] };
    persistGroups(updated);
    setNewGroupName("");
  };

  const removeGroup = (name: string) => {
    const { [name]: _, ...rest } = pageGroups;
    persistGroups(rest);
  };

  const addPageToGroup = (group: string, page: string) => {
    if (!page || !pageGroups[group]?.length) {
      // proceed; even if group empty we can still push
    }
    if (pageGroups[group]?.includes(page)) return;
    const updated = {
      ...pageGroups,
      [group]: [...(pageGroups[group] || []), page],
    };
    persistGroups(updated);
    setNewPageInputs((prev) => ({ ...prev, [group]: "" }));
    setAutocompleteKeys((prev) => ({
      ...prev,
      [group]: (prev[group] || 0) + 1,
    }));
  };

  const removePageFromGroup = (group: string, page: string) => {
    const updated = {
      ...pageGroups,
      [group]: pageGroups[group].filter((p) => p !== page),
    };
    persistGroups(updated);
  };

  const getPageInput = (group: string) => newPageInputs[group] || "";
  const setPageInput = useCallback((group: string, value: string) => {
    // Defer state update to avoid setState during another component render (React error #185)
    setTimeout(() => {
      setNewPageInputs((prev) => ({ ...prev, [group]: value }));
    }, 0);
  }, []);
  const getAutocompleteKey = (group: string) => autocompleteKeys[group] || 0;

  // Determine if embeddings have been uploaded on mount
  useEffect(() => {
    (async () => {
      const graphName = window.roamAlphaAPI.graph.name;
      const lastUpdateTime = await getLastUpdateTimeByGraphName(graphName);
      setEmbeddingsUploaded(lastUpdateTime !== null);
    })();
  }, []);

  const embeddingsButtonText = embeddingsUploaded
    ? "Upload Updated Node Embeddings"
    : "Generate & Upload All Node Embeddings";

  return (
    <div className="relative flex flex-col gap-4 p-1">
      <div className="absolute right-0 top-0">
        <Button
          icon="cross"
          minimal
          large
          intent={Intent.NONE}
          onClick={onClose}
        />
      </div>
      <Label>
        Personal Node Menu Trigger
        <Description
          description={
            "Override the global trigger for the Discourse Node Menu. Must refresh after editing."
          }
        />
        <NodeMenuTriggerComponent extensionAPI={extensionAPI} />
      </Label>
      <Label>
        Node Search Menu Trigger
        <Description
          description={
            "Set the trigger character for the Node Search Menu. Must refresh after editing."
          }
        />
        <NodeSearchMenuTriggerSetting onloadArgs={onloadArgs} />
      </Label>
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get("discourse-context-overlay") as boolean
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set(
            "discourse-context-overlay",
            target.checked,
          );

          onPageRefObserverChange(overlayHandler)(target.checked);
        }}
        labelElement={
          <>
            Overlay
            <Description
              description={
                "Whether or not to overlay Discourse Context information over Discourse Node references."
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get("disable-sidebar-open") as boolean
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set("disable-sidebar-open", target.checked);
        }}
        labelElement={
          <>
            Disable Sidebar Open
            <Description
              description={
                "Disable opening new nodes in the sidebar when created"
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={extensionAPI.settings.get("page-preview") as boolean}
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set("page-preview", target.checked);
          onPageRefObserverChange(previewPageRefHandler)(target.checked);
        }}
        labelElement={
          <>
            Preview
            <Description
              description={
                "Whether or not to display page previews when hovering over page refs"
              }
            />
          </>
        }
      />
      <Checkbox
        defaultChecked={
          extensionAPI.settings.get("hide-feedback-button") as boolean
        }
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          extensionAPI.settings.set("hide-feedback-button", target.checked);

          if (target.checked) {
            hideFeedbackButton();
          } else {
            showFeedbackButton();
          }
        }}
        labelElement={
          <>
            Hide Feedback Button
            <Description
              description={
                "Hide the 'Send feedback' button at the bottom right of the screen."
              }
            />
          </>
        }
      />
      <Label>
        Discourse Suggestions
        <Description
          description={
            "Configure how Discourse Suggestions behave in the graph."
          }
        />
        <div className="flex flex-col gap-2 pl-2">
          <Label>
            Display
            <Description
              description={
                "Choose where Discourse Suggestions should appear. Only one mode can be active at a time."
              }
            />
            <div className="flex flex-col gap-1 pl-2">
              <Checkbox
                checked={splitEnabled}
                onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  setSplitEnabled(checked);
                  extensionAPI.settings.set(
                    "suggestion-display-split-view",
                    checked,
                  );
                }}
                labelElement={<>{"Split View"}</>}
              />
              <Checkbox
                checked={overlayEnabled}
                onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  setOverlayEnabled(checked);
                  extensionAPI.settings.set(
                    "suggestion-display-overlay",
                    checked,
                  );
                }}
                labelElement={<>{"In Overlay"}</>}
              />
              <Checkbox
                checked={inlineEnabled}
                onChange={(e) => {
                  const checked = (e.target as HTMLInputElement).checked;
                  setInlineEnabled(checked);
                  extensionAPI.settings.set(
                    "suggestion-display-inline",
                    checked,
                  );
                }}
                labelElement={<>{"Inline"}</>}
              />
            </div>
          </Label>

          {/* Default Page Groups for Suggestions */}
          <Label>
            Default Page Groups
            <Description
              description={
                "Organize pages into named groups that will be used by default when generating Discourse Suggestions."
              }
            />
            <div className="flex flex-col gap-2 pl-2">
              {/* Add Group */}
              <div className="flex items-center gap-2">
                <AutocompleteInput
                  value={newGroupName}
                  setValue={setNewGroupName}
                  placeholder="New group name…"
                  options={[]}
                />
                <Button
                  icon="plus"
                  small
                  minimal
                  disabled={
                    !newGroupName || pageGroups[newGroupName] !== undefined
                  }
                  onClick={() => addGroup(newGroupName)}
                />
              </div>

              {/* Existing Groups */}
              {Object.keys(pageGroups).length === 0 && (
                <div className="text-sm italic text-gray-500">
                  No groups added.
                </div>
              )}
              {Object.entries(pageGroups).map(([groupName, pages]) => (
                <div key={groupName} className="rounded border p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold">{groupName}</span>
                    <Button
                      icon="trash"
                      minimal
                      small
                      intent={Intent.DANGER}
                      onClick={() => removeGroup(groupName)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className="flex-0 min-w-[160px]"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && getPageInput(groupName)) {
                          e.preventDefault();
                          e.stopPropagation();
                          addPageToGroup(groupName, getPageInput(groupName));
                        }
                      }}
                    >
                      <AutocompleteInput
                        key={getAutocompleteKey(groupName)}
                        value={getPageInput(groupName)}
                        placeholder="Add page…"
                        setValue={(v) => setPageInput(groupName, v)}
                        options={allPages}
                        maxItemsDisplayed={50}
                      />
                    </div>
                    <Button
                      icon="plus"
                      small
                      minimal
                      onClick={() =>
                        addPageToGroup(groupName, getPageInput(groupName))
                      }
                      disabled={
                        !getPageInput(groupName) ||
                        pages.includes(getPageInput(groupName))
                      }
                    />
                  </div>
                  {pages.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {pages.map((p) => (
                        <Tag
                          key={p}
                          onRemove={() => removePageFromGroup(groupName, p)}
                          round
                          minimal
                        >
                          {p}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Label>
        </div>
      </Label>
      <Label>
        Supabase Embeddings
        <Description
          description={
            "Extract all text nodes from the current Roam graph, generate embeddings, and upload to Supabase. Process runs in background; check console for progress."
          }
        />
        <Button
          icon="cloud-upload"
          text={embeddingsButtonText}
          onClick={async () => {
            console.log("get discourse relations", getDiscourseRelations());
            console.log("handleGenerateEmbeddings: Starting process.");
            // const allNodes = await getAllDiscourseNodes();
            //const nodes = allNodes.slice(0, 101); // Take only the first 101 nodes
            //console.log("Discourse nodes (first 101):", nodes);
            // const nodesWithEmbeddings = await getEmbeddingsService(nodes);
            // console.log("Nodes with embeddings:", nodesWithEmbeddings);
            // Next: send nodesWithEmbeddings to Supabase

            // Test the new function with a sample URL
            const graphName = window.roamAlphaAPI.graph.name;
            const lastUpdateTime =
              await getLastUpdateTimeByGraphName(graphName);
            console.log("Last update time for", graphName, ":", lastUpdateTime);

            // if its null, then run the full embedding process
            if (lastUpdateTime === null) {
              await runFullEmbeddingProcess();
            } else {
              await upsertDiscourseNodes(lastUpdateTime);
            }
          }}
          intent={Intent.PRIMARY}
          style={{ marginTop: "8px" }}
        />
      </Label>
    </div>
  );
};

export default HomePersonalSettings;
