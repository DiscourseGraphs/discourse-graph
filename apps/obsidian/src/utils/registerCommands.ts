import { Editor, MarkdownView, Notice, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { NodeTypeModal } from "~/components/NodeTypeModal";
import ModifyNodeModal from "~/components/ModifyNodeModal";
import { BulkIdentifyDiscourseNodesModal } from "~/components/BulkIdentifyDiscourseNodesModal";
import { createDiscourseNode } from "./createNode";
import { VIEW_TYPE_MARKDOWN, VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import { createCanvas } from "~/components/canvas/utils/tldraw";
import { createOrUpdateDiscourseEmbedding } from "./syncDgNodesToSupabase";
import { publishNode } from "./publishNode";
import { addRelationToRelationsJson } from "~/components/canvas/utils/relationJsonUtils";
import type { DiscourseNode } from "~/types";

type RelationParams = {
  relationshipTypeId?: string;
  relationshipTargetFile?: TFile;
  isCurrentFileSource?: boolean;
};

const addRelationIfRequested = async (
  plugin: DiscourseGraphPlugin,
  createdOrSelectedFile: TFile,
  params: RelationParams,
): Promise<void> => {
  const {
    relationshipTypeId,
    relationshipTargetFile,
    isCurrentFileSource,
  } = params;
  if (!relationshipTypeId || !relationshipTargetFile) return;
  if (relationshipTargetFile === createdOrSelectedFile) return;

  const [sourceFile, targetFile] =
    isCurrentFileSource === true
      ? [relationshipTargetFile, createdOrSelectedFile]
      : [createdOrSelectedFile, relationshipTargetFile];
  await addRelationToRelationsJson({
    plugin,
    sourceFile,
    targetFile,
    relationTypeId: relationshipTypeId,
  });
};

type ModifyNodeSubmitParams = {
  nodeType: DiscourseNode;
  title: string;
  initialFile?: TFile;
  selectedExistingNode?: TFile;
  relationshipTypeId?: string;
  relationshipTargetFile?: TFile;
  isCurrentFileSource?: boolean;
};

const createModifyNodeModalSubmitHandler = (
  plugin: DiscourseGraphPlugin,
  editor: Editor,
): ((params: ModifyNodeSubmitParams) => Promise<void>) => {
  return async ({
    nodeType,
    title,
    selectedExistingNode,
    relationshipTypeId,
    relationshipTargetFile,
    isCurrentFileSource,
  }: ModifyNodeSubmitParams) => {
    if (selectedExistingNode) {
      editor.replaceSelection(`[[${selectedExistingNode.basename}]]`);
      await addRelationIfRequested(plugin, selectedExistingNode, {
        relationshipTypeId,
        relationshipTargetFile,
        isCurrentFileSource,
      });
    } else {
      const newFile = await createDiscourseNode({
        plugin,
        nodeType,
        text: title,
        editor,
      });
      if (newFile) {
        await addRelationIfRequested(plugin, newFile, {
          relationshipTypeId,
          relationshipTargetFile,
          isCurrentFileSource,
        });
      }
    }
  };
};

export const registerCommands = (plugin: DiscourseGraphPlugin) => {
  plugin.addCommand({
    id: "open-node-type-menu",
    name: "Open node type menu",
    hotkeys: [{ modifiers: ["Mod"], key: "\\" }],
    editorCallback: (editor: Editor) => {
      const hasSelection = !!editor.getSelection();

      if (hasSelection) {
        new NodeTypeModal(editor, plugin.settings.nodeTypes, plugin).open();
      } else {
        const currentFile =
          plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file ||
          undefined;
        new ModifyNodeModal(plugin.app, {
          nodeTypes: plugin.settings.nodeTypes,
          plugin,
          currentFile,
          onSubmit: createModifyNodeModalSubmitHandler(plugin, editor),
        }).open();
      }
    },
  });

  plugin.addCommand({
    id: "create-discourse-node",
    name: "Create discourse node",
    editorCallback: (editor: Editor) => {
      const currentFile =
        plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file ||
        undefined;
      new ModifyNodeModal(plugin.app, {
        nodeTypes: plugin.settings.nodeTypes,
        plugin,
        currentFile,
        onSubmit: createModifyNodeModalSubmitHandler(plugin, editor),
      }).open();
    },
  });

  plugin.addCommand({
    id: "bulk-identify-discourse-nodes",
    name: "Bulk identify discourse nodes",
    callback: () => {
      new BulkIdentifyDiscourseNodesModal(plugin.app, plugin).open();
    },
  });

  plugin.addCommand({
    id: "toggle-discourse-context",
    name: "Toggle discourse context",
    callback: () => {
      plugin.toggleDiscourseContextView();
    },
  });

  plugin.addCommand({
    id: "open-discourse-graph-settings",
    name: "Open Discourse Graphs settings",
    callback: () => {
      // plugin.app.setting is an unofficial API
      /* eslint-disable @typescript-eslint/no-unsafe-call */
      const setting = (plugin.app as unknown as { setting: any }).setting;
      setting.open();
      setting.openTabById(plugin.manifest.id);
      /* eslint-enable @typescript-eslint/no-unsafe-call */
    },
  });

  plugin.addCommand({
    id: "switch-to-tldraw-edit",
    name: "Switch to discourse markdown edit",
    checkCallback: (checking: boolean) => {
      const leaf = plugin.app.workspace.activeLeaf;
      if (!leaf) return false;

      if (!checking) {
        void leaf.setViewState({
          type: VIEW_TYPE_MARKDOWN,
          state: leaf.view.getState(),
        });
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "switch-to-tldraw-preview",
    name: "Switch to Discourse Graph canvas view",
    checkCallback: (checking: boolean) => {
      const leaf = plugin.app.workspace.activeLeaf;
      if (!leaf) return false;

      if (!checking) {
        void leaf.setViewState({
          type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
          state: leaf.view.getState(),
        });
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "create-discourse-graph-canvas",
    name: "Create new Discourse Graph canvas",
    icon: "layout-dashboard", // Using Lucide icon as per style guide
    callback: () => createCanvas(plugin),
  });

  plugin.addCommand({
    id: "sync-discourse-nodes-to-supabase",
    name: "Sync discourse nodes to Supabase",
    checkCallback: (checking: boolean) => {
      if (!plugin.settings.syncModeEnabled) {
        new Notice("Sync mode is not enabled", 3000);
        return false;
      }
      if (!checking) {
        void createOrUpdateDiscourseEmbedding(plugin)
          .then(() => {
            new Notice("Discourse nodes synced successfully", 3000);
          })
          .catch((error) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            new Notice(`Sync failed: ${errorMessage}`, 5000);
            console.error("Manual sync failed:", error);
          });
      }
      return true;
    },
  });
  plugin.addCommand({
    id: "publish-discourse-node",
    name: "Publish current node to lab space",
    checkCallback: (checking: boolean) => {
      if (!plugin.settings.syncModeEnabled) {
        new Notice("Sync mode is not enabled", 3000);
        return false;
      }
      const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView || !activeView.file) {
        return false;
      }
      const file = activeView.file;
      const cache = plugin.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter || {};
      if (!frontmatter.nodeTypeId) {
        return false;
      }
      if (!checking) {
        if (!frontmatter.nodeInstanceId) {
          new Notice("Please sync the node first");
          return true;
        }
        // TODO (in follow-up PRs):
        // Maybe sync the node now if unsynced
        // Ensure that the node schema is synced to the database, and shared
        // sync the assets to the database
        publishNode({ plugin, file, frontmatter })
          .then(() => {
            new Notice("Published");
          })
          .catch((error: Error) => {
            new Notice(error.message);
            console.error(error);
          });
      }
      return true;
    },
  });
};
