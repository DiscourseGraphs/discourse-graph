import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { OnloadArgs } from "roamjs-components/types";
import {
  Label,
  Checkbox,
  Button,
  Intent,
  Tag,
  Tabs,
  Tab,
  TabId,
  InputGroup,
  Tooltip,
  Position,
} from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { runFullEmbeddingProcess } from "~/utils/embeddingWorkflow";
import { getLastUpdateTimeByGraphName } from "~/utils/syncToEmbeddingDb";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import { upsertDiscourseNodes } from "~/utils/syncToEmbeddingDb";
import getDiscourseNodes, {
  DiscourseNode,
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { getSubTree } from "roamjs-components/util";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import { getSupabaseContext } from "~/utils/supabaseContext";
import { getNodeEnv } from "roamjs-components/util/env";
import { convertDgToSupabase } from "~/utils/convertDgToSupabase";

const BlockRenderer = ({ uid }: { uid: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // Clear previous content
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      if (uid) {
        window.roamAlphaAPI.ui.components.renderBlock({
          uid: uid,
          el: container,
        });
      }
    }
  }, [uid]);

  return <div ref={containerRef} className="my-2 rounded border p-2" />;
};

const NodeTemplateConfig = ({
  node,
  extensionAPI,
}: {
  node: DiscourseNode;
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const settingsKey = `discourse-graph-node-rule-${node.type}`;

  const [embeddingRef, setEmbeddingRef] = useState("");
  const [isFirstChild, setIsFirstChild] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);

  const blockUidToRender = useMemo(() => {
    if (!embeddingRef) return null;
    const match = embeddingRef.match(/\(\((.*)\)\)/);
    return match ? match[1] : null;
  }, [embeddingRef]);

  useEffect(() => {
    const settings = extensionAPI.settings.get(settingsKey) as
      | {
          embeddingRef: string;
          isFirstChild: boolean;
        }
      | undefined;

    if (settings) {
      setEmbeddingRef(settings.embeddingRef || "");
      setIsFirstChild(settings.isFirstChild || false);
    }
  }, [node.type, extensionAPI, settingsKey]);

  const handleSave = () => {
    extensionAPI.settings.set(settingsKey, {
      embeddingRef,
      isFirstChild,
    });
    setHasUnsavedChanges(false);
    console.log(`Rules for "${node.text}" saved!`);
    setCanUpdate(true);
  };

  const searchNodesForType = async (
    node: DiscourseNode,
    rules: { isFirstChild?: boolean; embeddingRef?: string },
  ): Promise<any[]> => {
    if (!node.format) return [];

    try {
      const regex = getDiscourseNodeFormatExpression(node.format);
      console.log("regex", regex);

      const regexPattern = regex.source
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');

      const query = `[
      :find ?node-title ?uid ?nodeCreateTime ?nodeEditTime
      :keys node-title uid childCreateTime childEditTime
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
        [(re-find ?title-regex ?node-title)]
        [?node :block/uid ?uid]
        [?node :create/time ?nodeCreateTime]
        [?node :edit/time ?nodeEditTime]
        ]`;

      const childByOrder = `[
      :find ?childUid ?childString ?nodeUid ?childCreateTime ?childEditTime
      :keys blockUid blockString nodeUid childCreateTime childEditTime
      :in $ ?firstChildUid 
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
        [(re-find ?title-regex ?node-title)]
        [?node :block/uid ?nodeUid]
        [?s :block/uid ?firstChildUid]
        [?s :block/string ?firstChildString]
        [?bg :block/page ?node]
        [?node :node/title ?tit]
        [?bg :block/string ?firstChildString]
        [?bg :block/children ?child]
        [?child :block/order 0]
        [?child :block/uid ?childUid]
        [?child :block/string ?childString]
        [?child :create/time ?childCreateTime]
        [?child :edit/time ?childEditTime]
        ]`;

      const results = rules.isFirstChild
        ? // @ts-ignore - backend to be added to roamjs-components
          window.roamAlphaAPI.q(
            childByOrder,
            rules.embeddingRef?.match(/\(\((.*)\)\)/)?.[1] ?? "",
          )
        : // @ts-ignore - backend to be added to roamjs-components
          await window.roamAlphaAPI.data.backend.q(query);

      console.log(
        "query",
        childByOrder,
        rules.embeddingRef?.match(/\(\((.*)\)\)/)?.[1] ?? "",
      );
      console.log("results", results);
      return results;
    } catch (error) {
      console.error(`Error querying for node type ${node.type}:`, error);
      console.error(`Node format:`, node.format);
      return [];
    }
  };

  // get all discourse nodes types
  // - get thes settings for where to put the embeddings

  const handleUpdateEmbeddings = async () => {
    setIsUpdating(true);
    console.log(`Starting embedding update for "${node.text}".`);

    const rules = extensionAPI.settings.get(settingsKey) as {
      isFirstChild?: boolean;
      embeddingRef?: string;
    };
    console.log(
      `Repopulating database for node type "${node.text}" with rules:`,
      rules,
    );
    const nodesOfType = await searchNodesForType(node, rules);
    console.log("nodesOfType", nodesOfType);

    if (rules.isFirstChild && Array.isArray(nodesOfType)) {
      const context = await getSupabaseContext();
      if (!context) {
        console.error("Could not get Supabase context. Aborting update.");
        setIsUpdating(false);
        return;
      }
      const { spaceId, userId: authorId } = context;

      const apiBase =
        getNodeEnv() === "development"
          ? "http://localhost:3000/api/supabase"
          : "https://discoursegraphs.com/api/supabase";
      const upsertRes = await fetch(`${apiBase}/content/upsert-for-page`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spaceId,
          authorId,
          items: nodesOfType,
        }),
      });
      if (!upsertRes.ok) {
        throw new Error("Failed to upsert content");
      }
      const data = (await upsertRes.json()) as any[];

      console.log(`Embeddings for "${node.text}" updated successfully.`);
      setCanUpdate(false);

      if (data && Array.isArray(data)) {
        // 1. Collect {id, text}
        const textsToEmbed = data.map((row: any) => ({
          contentId: row.id as number,
          text: row.text as string,
        }));

        // 2. Hit your embeddings endpoint in one batch
        const embedRes = await fetch(
          `http://localhost:3000/api/embeddings/openai/small`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              input: textsToEmbed.map((t) => t.text),
            }),
          },
        );
        const embedJson = (await embedRes.json()) as {
          data: { embedding: number[] }[];
        };

        // 3. Build rows for Supabase insert
        const embeddingRows = textsToEmbed.map((t: any, i: number) => ({
          target_id: t.contentId,
          model: "openai_text_embedding_3_small_1536", // match Supabase table & validators
          vector: embedJson.data[i].embedding,
          obsolete: false,
        }));

        // 4. Persist embeddings via Supabase API
        try {
          const embedInsertRes = await fetch(
            `${apiBase}/content-embedding/batch`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(embeddingRows),
            },
          );

          if (!embedInsertRes.ok) {
            const errorText = await embedInsertRes.text();
            throw new Error(
              `Failed to batch insert embeddings [${embedInsertRes.status}]: ${errorText}`,
            );
          }

          console.log(
            `Batch inserted ${embeddingRows.length} embeddings for node type "${node.text}"`,
          );

          // Reset updating state after successful insertion
          setIsUpdating(false);
        } catch (error) {
          console.error("Error inserting embeddings:", error);
          setIsUpdating(false);
          throw error; // Surface to outer catch for user feedback
        }
      }
    } else {
      setIsUpdating(false);
    }

    // TODO:
    // 2. For each node, get its content based on the rules.
    // 3. Generate embeddings and upsert to the database.
    // Example: await updateEmbeddingsForNodeType(node.type, rules);
    // await new Promise((resolve) => setTimeout(resolve, 2000)); // Placeholder for async work
    // console.log(`Finished updating embeddings for ${node.text}.`);
    //
    // setIsUpdating(false);
    // console.log(`Embeddings for "${node.text}" updated successfully.`);
    // setCanUpdate(false);
  };

  const templateUid = getSubTree({
    parentUid: node.type,
    key: "Template",
  }).uid;

  return (
    <div className="flex flex-col gap-4 p-4">
      <BlocksPanel
        title="Template"
        description={`The template that auto fills ${node.text} page when generated.`}
        order={0}
        parentUid={node.type}
        uid={templateUid}
        defaultValue={node.template}
      />
      <Label>
        Embedding Block Ref
        <Description description="Copy block ref from template which you want to be embedded and ranked." />
        <InputGroup
          value={embeddingRef}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setEmbeddingRef(e.target.value);
            setHasUnsavedChanges(true);
          }}
          placeholder="((...))"
        />
      </Label>
      {blockUidToRender && <BlockRenderer uid={blockUidToRender} />}
      <div className="flex flex-col gap-1 pl-2">
        <Checkbox
          label="First Child"
          checked={isFirstChild}
          onChange={(e) => {
            setIsFirstChild((e.target as HTMLInputElement).checked);
            setHasUnsavedChanges(true);
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          text="Save Rules"
          intent={Intent.PRIMARY}
          disabled={!hasUnsavedChanges}
          onClick={handleSave}
          style={{ maxWidth: "120px" }}
        />
        <Tooltip
          content="Save changes before updating embeddings"
          position={Position.TOP}
          disabled={canUpdate}
        >
          <Button
            text="Update Embeddings"
            intent={Intent.NONE}
            onClick={async () => {
              await convertDgToSupabase();
            }}
            style={{ minWidth: "140px" }}
            //disabled={!canUpdate}
            loading={isUpdating}
          />
        </Tooltip>
      </div>
    </div>
  );
};

const NodeRules = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const nodes = useMemo(
    () => getDiscourseNodes().filter(excludeDefaultNodes),
    [],
  );
  const [selectedTabId, setSelectedTabId] = useState<TabId>(
    nodes[0]?.type || "",
  );

  if (!nodes.length) {
    return (
      <div className="p-4 italic text-gray-500">
        No user-defined discourse nodes found. You can create them in Global
        Settings &gt; Grammar &gt; Nodes.
      </div>
    );
  }

  return (
    <Tabs
      onChange={(id) => setSelectedTabId(id)}
      selectedTabId={selectedTabId}
      vertical={true}
      renderActiveTabPanelOnly={true}
    >
      {nodes.map((n) => (
        <Tab
          key={n.type}
          id={n.type}
          title={n.text}
          panel={<NodeTemplateConfig node={n} extensionAPI={extensionAPI} />}
        />
      ))}
    </Tabs>
  );
};

const SuggestiveModeSettings = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const extensionAPI = onloadArgs.extensionAPI;

  const [splitEnabled, setSplitEnabled] = useState<boolean>(
    Boolean(extensionAPI.settings.get("suggestion-display-split-view")),
  );
  const [overlayEnabled, setOverlayEnabled] = useState<boolean>(
    Boolean(extensionAPI.settings.get("suggestion-display-overlay")),
  );
  const [inlineEnabled, setInlineEnabled] = useState<boolean>(
    Boolean(extensionAPI.settings.get("suggestion-display-inline")),
  );

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
  const [selectedTabId, setSelectedTabId] = useState<TabId>("display");
  const [embeddingsUploaded, setEmbeddingsUploaded] = useState<boolean>(false);

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

  const displayPanel = (
    <div className="p-4">
      <Label>
        Display Options
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
              extensionAPI.settings.set("suggestion-display-overlay", checked);
            }}
            labelElement={<>{"In Overlay"}</>}
          />
          <Checkbox
            checked={inlineEnabled}
            onChange={(e) => {
              const checked = (e.target as HTMLInputElement).checked;
              setInlineEnabled(checked);
              extensionAPI.settings.set("suggestion-display-inline", checked);
            }}
            labelElement={<>{"Inline"}</>}
          />
        </div>
      </Label>
    </div>
  );

  const pageGroupsPanel = (
    <div className="p-4">
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
              disabled={!newGroupName || pageGroups[newGroupName] !== undefined}
              onClick={() => addGroup(newGroupName)}
            />
          </div>

          {/* Existing Groups */}
          {Object.keys(pageGroups).length === 0 && (
            <div className="text-sm italic text-gray-500">No groups added.</div>
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
  );

  return (
    <div className="relative flex flex-col gap-4 p-1">
      <div className="mb-2 text-lg font-semibold text-neutral-dark">
        Discourse Suggestions
      </div>
      <div className="mt-4">
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
      </div>
      <Tabs
        id="suggestion-settings-tabs"
        onChange={(id) => setSelectedTabId(id)}
        selectedTabId={selectedTabId}
        renderActiveTabPanelOnly={true}
      >
        <Tab id="display" title="Display" panel={displayPanel} />
        <Tab id="page-groups" title="Page Groups" panel={pageGroupsPanel} />
        <Tab
          id="node-specific-rules"
          title="Node Specific Rules"
          panel={
            <div className="max-h-[60vh] overflow-y-auto">
              <NodeRules extensionAPI={extensionAPI} />
            </div>
          }
        />
      </Tabs>
    </div>
  );
};

export default SuggestiveModeSettings;
