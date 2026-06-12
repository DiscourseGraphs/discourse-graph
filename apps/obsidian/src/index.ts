import {
  Plugin,
  Editor,
  Menu,
  TFile,
  MarkdownView,
  WorkspaceLeaf,
  Notice,
} from "obsidian";
import { EditorView } from "@codemirror/view";
import { SettingsTab } from "~/components/Settings";
import { Settings, VIEW_TYPE_DISCOURSE_CONTEXT } from "~/types";
import {
  addConvertSubmenu,
  isImageFile,
  openConvertImageToNodeModal,
} from "~/utils/editorMenuUtils";
import { createImageEmbedHoverExtension } from "~/utils/imageEmbedHoverIcon";
import { createWikilinkDragExtension } from "~/utils/wikilinkDragHandler";
import {
  registerCommands,
  createModifyNodeModalSubmitHandler,
} from "~/utils/registerCommands";
import { DiscourseContextView } from "~/components/DiscourseContextView";
import { VIEW_TYPE_TLDRAW_DG_PREVIEW, FRONTMATTER_KEY } from "~/constants";
import { convertPageToDiscourseNode } from "~/utils/createNode";
import { DEFAULT_SETTINGS } from "~/constants";
import ModifyNodeModal from "~/components/ModifyNodeModal";
import { TagNodeHandler } from "~/utils/tagNodeHandler";
import { TldrawView } from "~/components/canvas/TldrawView";
import { NodeTagSuggestPopover } from "~/components/NodeTagSuggestModal";
import { InlineNodeTypePicker } from "~/components/InlineNodeTypePicker";
import { initializeSupabaseSync } from "~/utils/syncDgNodesToSupabase";
import { FileChangeListener } from "~/utils/fileChangeListener";
import generateUid from "~/utils/generateUid";
import {
  migrateFrontmatterRelationsToRelationsJson,
  mergeAllRelationsJsonToRoot,
} from "~/utils/relationsStore";
import { migrateImportFolderMetadata } from "./utils/importFolderMetadata";
import { registerTemplateSettingsSync } from "~/utils/templateSettingsSync";

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  private tagNodeHandler: TagNodeHandler | null = null;
  private fileChangeListener: FileChangeListener | null = null;
  private currentViewActions: { leaf: WorkspaceLeaf; action: HTMLElement }[] =
    [];
  private pendingCanvasSwitches = new Set<string>();
  private frontmatterRelationStyleEl: HTMLStyleElement | null = null;

  private static readonly RELATION_KEY_PREFIX = /^(?:relation|rel)_/i;

  async onload() {
    await this.loadSettings();

    await mergeAllRelationsJsonToRoot(this).catch((error) => {
      console.error("Failed to merge relations.json files:", error);
    });

    await migrateFrontmatterRelationsToRelationsJson(this).catch((error) => {
      console.error("Failed to migrate frontmatter relations:", error);
    });

    await migrateImportFolderMetadata(this).catch((error) => {
      console.error("Failed to migrate import folder metadata:", error);
    });

    registerTemplateSettingsSync(this);

    if (this.settings.syncModeEnabled === true) {
      void initializeSupabaseSync(this).catch((error) => {
        console.error("Failed to initialize Supabase sync:", error);
        new Notice(
          `Failed to initialize Supabase sync: ${error instanceof Error ? error.message : String(error)}`,
          5000,
        );
      });

      try {
        this.fileChangeListener = new FileChangeListener(this);
        this.fileChangeListener.initialize();
      } catch (error) {
        console.error("Failed to initialize FileChangeListener:", error);
        this.fileChangeListener = null;
      }
    }

    registerCommands(this);
    this.addSettingTab(new SettingsTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        (leaf: WorkspaceLeaf | null) => {
          this.cleanupViewActions();

          if (!leaf) return;

          const view = leaf.view;
          const file = view instanceof MarkdownView ? view.file : null;

          if (file) {
            const cache = this.app.metadataCache.getFileCache(file);
            const isCanvasFile = !!cache?.frontmatter?.[FRONTMATTER_KEY];

            if (this.pendingCanvasSwitches.has(file.path)) {
              if (view.getViewType() !== VIEW_TYPE_TLDRAW_DG_PREVIEW) {
                void leaf.setViewState({
                  type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
                  state: view.getState(),
                });
              }
              this.pendingCanvasSwitches.delete(file.path);
              return;
            }

            if (view instanceof MarkdownView && isCanvasFile) {
              const action = view.addAction(
                "layout",
                "View as canvas",
                async () => {
                  await leaf.setViewState({
                    type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
                    state: view.getState(),
                  });
                },
              );

              this.currentViewActions.push({ leaf, action });
            }
          }
        },
      ),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file: TFile | null) => {
        if (!file) return;

        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter?.[FRONTMATTER_KEY]) {
          this.pendingCanvasSwitches.add(file.path);
        }
      }),
    );

    this.registerView(
      VIEW_TYPE_DISCOURSE_CONTEXT,
      (leaf) => new DiscourseContextView(leaf, this),
    );

    this.addRibbonIcon("telescope", "Toggle discourse context", () => {
      this.toggleDiscourseContextView();
    });

    // Initialize frontmatter CSS
    this.updateFrontmatterStyles();

    // Initialize tag node handler
    try {
      this.tagNodeHandler = new TagNodeHandler(this);
      this.tagNodeHandler.initialize();
    } catch (error) {
      console.error("Failed to initialize TagNodeHandler:", error);
      this.tagNodeHandler = null;
    }
    this.registerView(
      VIEW_TYPE_TLDRAW_DG_PREVIEW,
      (leaf) => new TldrawView(leaf, this),
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
        if (isImageFile(file)) {
          addConvertSubmenu({
            menu,
            label: "Convert into",
            nodeTypes: this.settings.nodeTypes,
            onClick: (nodeType) => {
              openConvertImageToNodeModal({
                plugin: this,
                imageFile: file,
                initialNodeType: nodeType,
                // File explorer always intends to create a new node
                disableExistingNodeSearch: true,
              });
            },
          });
          return;
        }

        const fileCache = this.app.metadataCache.getFileCache(file);
        const fileNodeType = fileCache?.frontmatter?.nodeTypeId as
          | string
          | undefined;

        if (
          !fileNodeType ||
          !this.settings.nodeTypes.some(
            (nodeType) => nodeType.id === fileNodeType,
          )
        ) {
          addConvertSubmenu({
            menu,
            label: "Convert into",
            nodeTypes: this.settings.nodeTypes,
            onClick: (nodeType) => {
              new ModifyNodeModal(this.app, {
                nodeTypes: this.settings.nodeTypes,
                plugin: this,
                initialTitle: file.basename,
                initialNodeType: nodeType,
                // File explorer always intends to create a new node
                disableExistingNodeSearch: true,
                onSubmit: async ({ nodeType, title }) => {
                  await convertPageToDiscourseNode({
                    plugin: this,
                    file,
                    nodeType,
                    title,
                  });
                },
              }).open();
            },
          });
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
        if (!editor.getSelection()) return;

        const selection = editor.getSelection().trim();
        const currentFile =
          this.app.workspace.getActiveViewOfType(MarkdownView)?.file ||
          undefined;
        addConvertSubmenu({
          menu,
          label: "Turn into discourse node",
          nodeTypes: this.settings.nodeTypes,
          onClick: (nodeType) => {
            new ModifyNodeModal(this.app, {
              nodeTypes: this.settings.nodeTypes,
              plugin: this,
              initialTitle: selection,
              initialNodeType: nodeType,
              currentFile,
              onSubmit: createModifyNodeModalSubmitHandler(this, editor),
            }).open();
          },
        });
      }),
    );

    type EditorWithCm = { cm: EditorView };
    const hasCodeMirrorView = (editor: unknown): editor is EditorWithCm => {
      if (!editor || typeof editor !== "object") return false;
      return "cm" in editor;
    };

    // Dispatch a no-op CM6 transaction to every markdown editor so their
    // ViewPlugin re-evaluates hasVisibleCanvasLeaf and shows/hides widgets.
    // layout-change covers splits/moves, active-leaf-change covers tab switches.
    const refreshMarkdownEditors = (): void => {
      this.app.workspace.iterateAllLeaves((leaf) => {
        if (
          leaf.view instanceof MarkdownView &&
          hasCodeMirrorView(leaf.view.editor)
        ) {
          leaf.view.editor.cm.dispatch({});
        }
      });
    };
    this.registerEvent(
      this.app.workspace.on("layout-change", refreshMarkdownEditors),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", refreshMarkdownEditors),
    );

    // Register editor keydown listener for node tag hotkey
    this.setupNodeTagHotkey();
  }

  private setupNodeTagHotkey() {
    const nodeTagHotkeyExtension = EditorView.domEventHandlers({
      keydown: (event: KeyboardEvent) => {
        // Access settings dynamically to handle changes
        const hotkey = this.settings.nodeTagHotkey;

        if (!hotkey || event.key !== hotkey) {
          return false;
        }
        event.preventDefault();
        event.stopPropagation();

        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.editor) {
          const editor = activeView.editor;
          const selectedText = editor.getSelection();

          if (selectedText && selectedText.trim().length > 0) {
            // Text is selected: open node type picker to create node from selection
            const picker = new InlineNodeTypePicker({
              editor,
              nodeTypes: this.settings.nodeTypes,
              plugin: this,
              selectedText: selectedText.trim(),
            });
            picker.open();
          } else {
            // No selection: open the candidate node tag popover
            const popover = new NodeTagSuggestPopover(
              editor,
              this.settings.nodeTypes,
            );
            popover.open();
          }
        }

        return true;
      },
    });

    this.registerEditorExtension(nodeTagHotkeyExtension);

    this.registerEditorExtension(createImageEmbedHoverExtension(this));

    this.registerEditorExtension(createWikilinkDragExtension(this));
  }

  updateFrontmatterStyles(): void {
    const hideIds = !this.settings.showIdsInFrontmatter;
    activeDocument.body.classList.toggle("dg-hide-frontmatter-ids", hideIds);
    this.updateImportedRelationFrontmatterStyles(hideIds);
  }

  private updateImportedRelationFrontmatterStyles(hideIds: boolean): void {
    let styleEl = this.frontmatterRelationStyleEl;
    if (!styleEl) {
      styleEl = activeDocument.createEl("style", {
        attr: { id: "discourse-graph-relation-frontmatter-styles" },
      });
      activeDocument.head.appendChild(styleEl);
      this.frontmatterRelationStyleEl = styleEl;
    }

    if (!hideIds) {
      styleEl.textContent = "";
      return;
    }

    const idsToHide = this.settings.relationTypes
      .map((relationType) => relationType.id)
      .filter((id) => !DiscourseGraphPlugin.RELATION_KEY_PREFIX.test(id));

    if (idsToHide.length === 0) {
      styleEl.textContent = "";
      return;
    }

    const selectors = idsToHide
      .map(
        (key) =>
          `body.dg-hide-frontmatter-ids .metadata-property[data-property-key="${CSS.escape(key)}" i]`,
      )
      .join(", ");

    styleEl.textContent = `${selectors} { display: none !important; }`;
  }

  toggleDiscourseContextView() {
    const { workspace } = this.app;
    const existingLeaf = workspace.getLeavesOfType(
      VIEW_TYPE_DISCOURSE_CONTEXT,
    )[0];

    if (existingLeaf) {
      existingLeaf.detach();
    } else {
      const activeFile = workspace.getActiveFile();
      const leaf = workspace.getRightLeaf(false);
      if (leaf) {
        const layoutChangeHandler = () => {
          const view = leaf.view;
          if (view instanceof DiscourseContextView) {
            view.setActiveFile(activeFile);
            workspace.off("layout-change", layoutChangeHandler);
          }
        };

        workspace.on("layout-change", layoutChangeHandler);

        void leaf.setViewState({
          type: VIEW_TYPE_DISCOURSE_CONTEXT,
          active: true,
        });
        void workspace.revealLeaf(leaf);
      }
    }
  }

  async loadSettings() {
    const loadedData = (await this.loadData()) as Record<string, unknown>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
    const changed = this.migrateSettings();

    if (changed || !loadedData || this.hasNewFields(loadedData)) {
      await this.saveSettings();
    } else {
      this.updateFrontmatterStyles();
    }
  }

  private hasNewFields(loadedData: unknown): boolean {
    return Object.keys(DEFAULT_SETTINGS).some(
      (key) => !(key in (loadedData as Record<string, unknown>)),
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.updateFrontmatterStyles();
  }

  private migrateSettings(): boolean {
    let changed = false;
    const now = new Date().getTime();
    for (const typeObject of [
      ...this.settings.nodeTypes,
      ...this.settings.relationTypes,
      ...this.settings.discourseRelations,
    ]) {
      if (!typeObject.created) {
        typeObject.created = now;
        changed = true;
      }
      if (!typeObject.modified) {
        typeObject.modified = now;
        changed = true;
      }
    }
    // nodeTypes and relationTypes already have Ids
    for (const typeObject of this.settings.discourseRelations) {
      if (!typeObject.id) {
        typeObject.id = generateUid("rel3");
        changed = true;
      }
    }
    return changed;
  }

  private cleanupViewActions() {
    this.currentViewActions.forEach(({ leaf, action }) => {
      try {
        if (leaf.view) {
          action.remove();
        }
      } catch (e) {
        console.error("Failed to cleanup view action:", e);
      }
    }, this);
    this.currentViewActions = [];
  }

  onunload() {
    this.cleanupViewActions();
    activeDocument.body.classList.remove("dg-hide-frontmatter-ids");
    this.frontmatterRelationStyleEl?.remove();
    this.frontmatterRelationStyleEl = null;

    if (this.tagNodeHandler) {
      this.tagNodeHandler.cleanup();
      this.tagNodeHandler = null;
    }

    if (this.fileChangeListener) {
      this.fileChangeListener.cleanup();
      this.fileChangeListener = null;
    }
  }
}
