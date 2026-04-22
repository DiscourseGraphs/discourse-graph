import { App, Modal, Notice } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { StrictMode, useState, useEffect, useCallback } from "react";
import type DiscourseGraphPlugin from "../index";
import type { ImportableNode, GroupWithNodes } from "~/types";
import {
  getAvailableGroupIds,
  getPublishedNodesForGroups,
  getLocalNodeInstanceIds,
  getSpaceNameFromIds,
  getSpaceUris,
  importSelectedNodes,
} from "~/utils/importNodes";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";
import {
  computeImportPreview,
  type ImportPreviewData,
} from "~/utils/importPreview";

type ImportNodesModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

const ImportNodesContent = ({ plugin, onClose }: ImportNodesModalProps) => {
  const [step, setStep] = useState<
    "loading" | "select" | "preview" | "importing"
  >("loading");
  const [groupsWithNodes, setGroupsWithNodes] = useState<GroupWithNodes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(
    null,
  );
  const [previewLoading, setPreviewLoading] = useState(false);

  const loadImportableNodes = useCallback(async () => {
    setIsLoading(true);
    try {
      const client = await getLoggedInClient(plugin);
      if (!client) {
        new Notice("Cannot get Supabase client");
        onClose();
        return;
      }

      const context = await getSupabaseContext(plugin);
      if (!context) {
        new Notice("Cannot get Supabase context");
        onClose();
        return;
      }

      const groupIds = await getAvailableGroupIds(client);
      if (groupIds.length === 0) {
        new Notice("You are not a member of any groups");
        onClose();
        return;
      }

      const publishedNodes = await getPublishedNodesForGroups({
        client,
        groupIds,
        currentSpaceId: context.spaceId,
      });

      const localNodeInstanceIds = getLocalNodeInstanceIds(plugin);

      // Filter out nodes that already exist locally
      const importableNodes = publishedNodes.filter(
        (node) => !localNodeInstanceIds.has(node.source_local_id),
      );

      const uniqueSpaceIds = [
        ...new Set(importableNodes.map((n) => n.space_id)),
      ];
      const [spaceNames, spaceUris] = await Promise.all([
        getSpaceNameFromIds(client, uniqueSpaceIds),
        getSpaceUris(client, uniqueSpaceIds),
      ]);

      // Populate plugin settings with current space names so they stay up to date
      if (uniqueSpaceIds.length > 0) {
        if (!plugin.settings.spaceNames) plugin.settings.spaceNames = {};

        for (const spaceId of uniqueSpaceIds) {
          const spaceUri = spaceUris.get(spaceId);
          const spaceName = spaceNames.get(spaceId);
          if (spaceUri && spaceName) {
            plugin.settings.spaceNames[spaceUri] = spaceName;
          }
        }
        await plugin.saveSettings();
      }

      const grouped: Map<string, GroupWithNodes> = new Map();

      for (const node of importableNodes) {
        const groupId = String(node.space_id);
        if (!grouped.has(groupId)) {
          grouped.set(groupId, {
            groupId,
            groupName:
              spaceNames.get(node.space_id) ?? `Space ${node.space_id}`,
            nodes: [],
          });
        }

        const group = grouped.get(groupId)!;
        group.nodes.push({
          nodeInstanceId: node.source_local_id,
          title: node.text,
          spaceId: node.space_id,
          spaceName: spaceNames.get(node.space_id) ?? `Space ${node.space_id}`,
          groupId,
          selected: false,
          createdAt: node.createdAt,
          modifiedAt: node.modifiedAt,
          filePath: node.filePath,
          authorName: node.authorName,
        });
      }

      setGroupsWithNodes(Array.from(grouped.values()));
      setStep("select");
    } catch (error) {
      console.error("Error loading importable nodes:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to load nodes: ${errorMessage}`, 5000);
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [plugin, onClose]);

  useEffect(() => {
    void loadImportableNodes();
  }, [loadImportableNodes]);

  const handleNodeToggle = (groupId: string, nodeIndex: number) => {
    setGroupsWithNodes((prev) =>
      prev.map((group) => {
        if (group.groupId !== groupId) return group;
        return {
          ...group,
          nodes: group.nodes.map((node, idx) =>
            idx === nodeIndex ? { ...node, selected: !node.selected } : node,
          ),
        };
      }),
    );
  };

  const getSelectedNodes = (): ImportableNode[] => {
    const selected: ImportableNode[] = [];
    for (const group of groupsWithNodes) {
      for (const node of group.nodes) {
        if (node.selected) {
          selected.push(node);
        }
      }
    }
    return selected;
  };

  const handleNext = async () => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) {
      new Notice("Please select at least one node to import");
      return;
    }

    setPreviewLoading(true);
    try {
      const preview = await computeImportPreview({ plugin, selectedNodes });
      setPreviewData(preview);
      setStep("preview");
    } catch (error) {
      console.error("Error computing preview:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Failed to compute preview: ${errorMessage}`, 5000);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    const selectedNodes = getSelectedNodes();
    if (selectedNodes.length === 0) {
      new Notice("Please select at least one node to import");
      return;
    }

    setStep("importing");
    setImportProgress({ current: 0, total: selectedNodes.length });

    try {
      const result = await importSelectedNodes({
        plugin,
        selectedNodes,
        onProgress: (current, total) => {
          setImportProgress({ current, total });
        },
        precomputedData: previewData
          ? {
              nodeKeys: previewData.nodeKeys,
              keyToRid: previewData.keyToRid,
              keyToRelationEndpointId: previewData.keyToRelationEndpointId,
              relationInstancesBySpace: previewData.relationInstancesBySpace,
            }
          : undefined,
      });

      if (result.failed > 0) {
        new Notice(
          `Import completed with some issues:\n${result.success} files imported successfully\n${result.failed} files failed`,
          5000,
        );
      } else {
        new Notice(`Successfully imported ${result.success} node(s)`, 3000);
      }

      onClose();
    } catch (error) {
      console.error("Error importing nodes:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Import failed: ${errorMessage}`, 5000);
      setStep("select");
    }
  };

  const renderLoadingStep = () => (
    <div className="text-center">
      <h3 className="mb-4">Loading importable nodes...</h3>
      <div className="text-muted text-sm">
        Fetching groups and published nodes
      </div>
    </div>
  );

  const renderSelectStep = () => {
    const totalNodes = groupsWithNodes.reduce(
      (sum, group) => sum + group.nodes.length,
      0,
    );
    const selectedCount = groupsWithNodes.reduce(
      (sum, group) => sum + group.nodes.filter((n) => n.selected).length,
      0,
    );

    // Group nodes by space for better organization
    const nodesBySpace = new Map<
      number,
      {
        spaceName: string;
        nodes: Array<{
          node: ImportableNode;
          groupId: string;
          nodeIndex: number;
        }>;
      }
    >();

    for (const group of groupsWithNodes) {
      for (const [nodeIndex, node] of group.nodes.entries()) {
        if (!nodesBySpace.has(node.spaceId)) {
          nodesBySpace.set(node.spaceId, {
            spaceName: node.spaceName,
            nodes: [],
          });
        }
        nodesBySpace.get(node.spaceId)!.nodes.push({
          node,
          groupId: group.groupId,
          nodeIndex,
        });
      }
    }

    return (
      <div>
        <h3 className="mb-4">Select Nodes to Import</h3>
        <p className="text-muted mb-4 text-sm">
          {totalNodes > 0
            ? `${totalNodes} importable node(s) found. Select which nodes to import into your vault.`
            : "No importable nodes found."}
        </p>

        <div className="mb-4">
          <button
            onClick={() =>
              setGroupsWithNodes((prev) =>
                prev.map((group) => ({
                  ...group,
                  nodes: group.nodes.map((n) => ({ ...n, selected: true })),
                })),
              )
            }
            className="mr-2 rounded border px-3 py-1 text-sm"
          >
            Select All
          </button>
          <button
            onClick={() =>
              setGroupsWithNodes((prev) =>
                prev.map((group) => ({
                  ...group,
                  nodes: group.nodes.map((n) => ({ ...n, selected: false })),
                })),
              )
            }
            className="rounded border px-3 py-1 text-sm"
          >
            Deselect All
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto rounded border">
          {Array.from(nodesBySpace.entries()).map(
            ([spaceId, { spaceName, nodes }]) => {
              return (
                <div key={spaceId} className="border-b">
                  <div className="bg-muted/10 flex items-center px-3 py-2">
                    <span className="mr-2">📂</span>
                    <span className="text-accent-foreground line-clamp-1 font-medium italic">
                      {spaceName}
                    </span>
                    <span className="text-muted ml-2 text-sm">
                      ({nodes.length} node{nodes.length !== 1 ? "s" : ""})
                    </span>
                  </div>

                  {nodes.map(({ node, groupId, nodeIndex }) => (
                    <div
                      key={`${node.nodeInstanceId}-${groupId}`}
                      className="flex items-start border-t p-3 pl-8"
                    >
                      <input
                        type="checkbox"
                        checked={node.selected}
                        onChange={() => handleNodeToggle(groupId, nodeIndex)}
                        className="mr-3 mt-1 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-3 font-medium">
                          {node.title}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            },
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={onClose} className="px-4 py-2">
            Cancel
          </button>
          <button
            onClick={() => {
              void handleNext();
            }}
            className="!bg-accent !text-on-accent rounded px-4 py-2"
            disabled={selectedCount === 0 || previewLoading}
          >
            {previewLoading ? "Loading..." : `Next (${selectedCount})`}
          </button>
        </div>
      </div>
    );
  };

  const renderPreviewStep = () => {
    if (!previewData) return null;

    const hasNewNodeTypes = previewData.newNodeTypeSchemas.length > 0;
    const hasNewRelationTypes = previewData.newRelationTypeSchemas.length > 0;
    const newTriplets = previewData.relationTriplets.filter(
      (t) => t.isNewTriplet,
    );
    const hasNewTriplets = newTriplets.length > 0;
    const hasAnyNew = hasNewNodeTypes || hasNewRelationTypes || hasNewTriplets;

    return (
      <div>
        <h3 className="mb-2">Import Preview</h3>
        <p className="text-muted mb-4 text-sm">
          Review what will be imported and created.
        </p>

        <div className="max-h-96 overflow-y-auto">
          {/* Summary section */}
          <div className="mb-4 rounded border p-3">
            <div className="mb-1 text-sm font-medium uppercase tracking-wide opacity-60">
              Summary
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="font-semibold">
                  {previewData.selectedNodeCount}
                </span>{" "}
                node{previewData.selectedNodeCount !== 1 ? "s" : ""}
              </div>
              <div>
                <span className="font-semibold">
                  {previewData.relationInstanceCount}
                </span>{" "}
                relation{previewData.relationInstanceCount !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* New schemas section */}
          {hasAnyNew && (
            <div className="mb-4 rounded border p-3">
              <div className="mb-2 text-sm font-medium uppercase tracking-wide opacity-60">
                New schemas to create
              </div>

              {hasNewNodeTypes && (
                <div className="mb-2">
                  <div className="mb-1 text-sm font-medium">Node types</div>
                  <div className="flex flex-wrap gap-1">
                    {previewData.newNodeTypeSchemas.map((nt) => (
                      <span
                        key={nt.id}
                        className="bg-accent/15 text-accent rounded px-2 py-0.5 text-xs"
                      >
                        {nt.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {hasNewRelationTypes && (
                <div className="mb-2">
                  <div className="mb-1 text-sm font-medium">Relation types</div>
                  <div className="flex flex-wrap gap-1">
                    {previewData.newRelationTypeSchemas.map((rt) => (
                      <span
                        key={rt.id}
                        className="bg-accent/15 text-accent rounded px-2 py-0.5 text-xs"
                      >
                        {rt.label}
                        {rt.complement ? ` / ${rt.complement}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {hasNewTriplets && (
                <div>
                  <div className="mb-1 text-sm font-medium">
                    Discourse relations
                  </div>
                  <div className="space-y-1">
                    {newTriplets.map((t, i) => (
                      <div key={i} className="flex items-center gap-1 text-xs">
                        <span className="rounded bg-secondary px-1.5 py-0.5">
                          {t.sourceNodeTypeName}
                        </span>
                        <span className="text-accent font-medium">
                          {t.relationTypeLabel}
                        </span>
                        <span className="rounded bg-secondary px-1.5 py-0.5">
                          {t.destNodeTypeName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!hasAnyNew && (
            <div className="text-muted rounded border p-3 text-center text-sm">
              No new schemas or relations will be created.
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <button onClick={() => setStep("select")} className="px-4 py-2">
            Back
          </button>
          <button
            onClick={() => {
              void handleImport();
            }}
            className="!bg-accent !text-on-accent rounded px-4 py-2"
          >
            Confirm Import
          </button>
        </div>
      </div>
    );
  };

  const renderImportingStep = () => (
    <div className="text-center">
      <h3 className="mb-4">Importing nodes</h3>
      <div className="mb-4">
        <div className="bg-modifier-border mb-2 h-2 rounded-full">
          <div
            className="bg-accent h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(importProgress.current / importProgress.total) * 100}%`,
            }}
          />
        </div>
        <div className="text-muted text-sm">
          {importProgress.current} of {importProgress.total} node(s) processed
        </div>
      </div>
    </div>
  );

  if (isLoading || step === "loading") {
    return renderLoadingStep();
  }

  switch (step) {
    case "select":
      return renderSelectStep();
    case "preview":
      return renderPreviewStep();
    case "importing":
      return renderImportingStep();
    default:
      return null;
  }
};

export class ImportNodesModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.root = createRoot(contentEl);
    this.root.render(
      <StrictMode>
        <ImportNodesContent plugin={this.plugin} onClose={() => this.close()} />
      </StrictMode>,
    );
  }

  onClose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
