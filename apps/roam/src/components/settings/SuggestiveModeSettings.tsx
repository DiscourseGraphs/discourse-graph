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
import getDiscourseNodes, {
  DiscourseNode,
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { getSubTree } from "roamjs-components/util";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import { getSupabaseContext } from "~/utils/supabaseContext";
import { getNodeEnv } from "roamjs-components/util/env";
import { LocalContentDataInput } from "../../../../../packages/database/inputTypes";
import {
  getAllDiscourseNodesSince,
  getDiscourseNodeTypeBlockNodes,
} from "~/utils/getAllDiscourseNodesSince";
import {
  createOrUpdateDiscourseEmbedding,
  upsertNodesToSupabaseAsContentWithEmbeddings,
} from "~/utils/syncDgNodesToSupabase";
import { discourseNodeBlockToLocalConcept } from "~/utils/conceptConversion";

const base_url =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://discourse-graph-git-store-in-supabase-discourse-graphs.vercel.app";

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

  const handleUpdateEmbeddings = async () => {
    setIsUpdating(true);
    console.log(`Starting embedding update for "${node.text}" .`, node);
    console.log("extensionAPI.settings", extensionAPI.settings);
    console.log("settingsKey", extensionAPI.settings.get(settingsKey));

    const rules = extensionAPI.settings.get(settingsKey) as {
      isFirstChild?: boolean;
      embeddingRef?: string;
    };
    console.log(
      `Repopulating database for node type "${node.text}" with rules:`,
      rules,
    );
    const blockNodesSince = getDiscourseNodeTypeBlockNodes(
      node,
      0,
      extensionAPI as OnloadArgs["extensionAPI"],
    );
    console.log("blockNodesSince", blockNodesSince);
    const context = await getSupabaseContext();
    if (context && blockNodesSince) {
      await upsertNodesToSupabaseAsContentWithEmbeddings(blockNodesSince);
      const nodeBlockToLocalConcepts = blockNodesSince.map((node) => {
        const localConcept = discourseNodeBlockToLocalConcept(context, {
          nodeUid: node.source_local_id,
          schemaUid: node.type,
          text: node.node_title ? `${node.node_title} ${node.text}` : node.text,
        });
        return localConcept;
      });
      const response = await fetch(
        `${base_url}/api/supabase/rpc/upsert-concepts`,
        {
          method: "POST",
          body: JSON.stringify({
            v_space_id: context.spaceId,
            data: nodeBlockToLocalConcepts,
          }),
        },
      );
      const { error } = await response.json();
      if (error) {
        throw new Error(
          `upsert_concepts failed: ${JSON.stringify(error, null, 2)}`,
        );
      }
      console.log("Successfully upserted concepts.");
    }
    setIsUpdating(false);
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
              await handleUpdateEmbeddings();
            }}
            style={{ minWidth: "140px" }}
            disabled={!canUpdate}
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
  // useEffect(() => {
  //   (async () => {
  //     const graphName = window.roamAlphaAPI.graph.name;
  //     const lastUpdateTime = await getLastUpdateTimeByGraphName(graphName);
  //     setEmbeddingsUploaded(lastUpdateTime !== null);
  //   })();
  // }, []);

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
            await createOrUpdateDiscourseEmbedding(extensionAPI);
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
