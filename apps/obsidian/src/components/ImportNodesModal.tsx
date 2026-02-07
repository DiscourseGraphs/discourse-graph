import { App, Modal, Notice } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { StrictMode, useState, useEffect, useCallback } from "react";
import type DiscourseGraphPlugin from "../index";
import type { ImportableNode, GroupWithNodes } from "~/types";
import {
  getAvailableGroups,
  getPublishedNodesForGroups,
  getLocalNodeInstanceIds,
  getSpaceNameFromIds,
  importSelectedNodes,
} from "~/utils/importNodes";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";

type ImportNodesModalProps = {
  plugin: DiscourseGraphPlugin;
  onClose: () => void;
};

const ImportNodesContent = ({ plugin, onClose }: ImportNodesModalProps) => {
  const [step, setStep] = useState<"loading" | "select" | "importing">(
    "loading",
  );
  const [groupsWithNodes, setGroupsWithNodes] = useState<GroupWithNodes[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
  });

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

      const groups = await getAvailableGroups(client);
      if (groups.length === 0) {
        new Notice("You are not a member of any groups");
        onClose();
        return;
      }

      const groupIds = groups.map((g) => g.group_id);

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
      const spaceNames = await getSpaceNameFromIds(client, uniqueSpaceIds);
      const grouped: Map<string, GroupWithNodes> = new Map();

      for (const node of importableNodes) {
        const groupId = node.account_uid;
        if (!grouped.has(groupId)) {
          grouped.set(groupId, {
            groupId,
            groupName: `Group ${groupId.slice(0, 8)}...`,
            nodes: [],
          });
        }

        const group = grouped.get(groupId)!;
        group.nodes.push({
          nodeInstanceId: node.source_local_id,
          title: node.text,
          spaceId: node.space_id,
          spaceName: spaceNames.get(node.space_id) ?? `Space ${node.space_id}`,
          groupId: node.account_uid,
          selected: false,
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

  const handleImport = async () => {
    const selectedNodes: ImportableNode[] = [];
    for (const group of groupsWithNodes) {
      for (const node of group.nodes) {
        if (node.selected) {
          selectedNodes.push(node);
        }
      }
    }

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
              void handleImport();
            }}
            className="!bg-accent !text-on-accent rounded px-4 py-2"
            disabled={selectedCount === 0}
          >
            Import ({selectedCount})
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
