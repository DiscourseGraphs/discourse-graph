import { TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import type DiscourseGraphPlugin from "~/index";
import { Root, createRoot } from "react-dom/client";
import { TldrawPreviewComponent } from "./TldrawPreviewComponent";
import {
  ErrorBoundary,
  SerializedStore,
  StoreSnapshot,
  TLRecord,
  TLStore,
  Tldraw,
  TldrawUiContextProvider,
  createTLStore,
  defaultShapeUtils,
  loadSnapshot,
} from "tldraw";
import React from "react";

export class TldrawPreview extends TextFileView {
  plugin: DiscourseGraphPlugin;
  private reactRoot?: Root;
  private store?: TLStore;
  private onUnloadCallbacks: (() => void)[] = [];

  constructor(leaf: WorkspaceLeaf, plugin: DiscourseGraphPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = true;
  }

  getViewType(): string {
    return VIEW_TYPE_TLDRAW_DG_PREVIEW;
  }

  getDisplayText(): string {
    return this.file?.basename ?? "Discourse Graph Canvas Preview";
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, clear: boolean): void {
    this.data = data;
  }

  clear(): void {
    this.data = "";
  }

  protected get tldrawContainer() {
    return this.containerEl.children[1];
  }

  override onload(): void {
    super.onload();
    this.contentEl.addClass("tldraw-view-content");
  }

  async onOpen() {
    const container = this.tldrawContainer;
    if (!container) return;

    container.empty();
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);

    const fileData = await this.app.vault.read(file);
    console.log("onLoadFile", file.path, fileData?.length);

    // Create store from file data
    const store = await this.createStore(fileData);

    console.log("store on load file", store);
    if (!store) {
      console.warn("No tldraw data found in file");
      return;
    }

    // Set up store and refresh view
    await this.setStore(store);
  }

  private async createStore(fileData: string): Promise<TLStore | undefined> {
    try {
      // Parse the markdown content to get the tldraw data
      const match = fileData.match(
        /```json !!!_START_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!([\s\S]*?)!!!_END_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!\n```/,
      );
      console.log("match", match);

      if (!match?.[1]) {
        console.warn("No tldraw data found in file");
        return;
      }

      const data = JSON.parse(match[1]);
      if (!data.raw) {
        console.warn("Invalid tldraw data format - missing raw field");
        return;
      }
      console.log("data parsed", data);

      // Create store with shape utils and initial data

      // Transform records array to object if needed
      const recordsData = Array.isArray(data.raw.records)
        ? data.raw.records.reduce(
            (
              acc: Record<string, TLRecord>,
              record: { id: string } & TLRecord,
            ) => {
              // Use record.id as the key
              acc[record.id] = {
                ...record,
              };
              return acc;
            },
            {},
          )
        : data.raw.records;

      console.log("recordsData", recordsData);

      const store = createTLStore({
        shapeUtils: defaultShapeUtils,
        initialData: recordsData,
      });

      // Ensure required records exist with correct structure
      const records = recordsData || {};
      const requiredRecords = {
        page: records["page:page"],
        instance: records["instance:instance"],
        instancePageState: records["instance_page_state:page:page"],
      };

      // Validate required records
      if (
        !requiredRecords.page?.id ||
        !requiredRecords.instance?.id ||
        !requiredRecords.instancePageState?.id
      ) {
        console.error("Missing required records:", {
          hasPage: !!requiredRecords.page?.id,
          hasInstance: !!requiredRecords.instance?.id,
          hasInstancePageState: !!requiredRecords.instancePageState?.id,
        });
        return;
      }

      // Validate record relationships
      if (requiredRecords.instance.currentPageId !== requiredRecords.page.id) {
        console.error("Instance currentPageId doesn't match page id");
        return;
      }

      if (
        requiredRecords.instancePageState.pageId !== requiredRecords.page.id
      ) {
        console.error("InstancePageState pageId doesn't match page id");
        return;
      }

      try {
        // Load the snapshot with transformed records
        // const snapshot: StoreSnapshot<TLRecord> = {
        //   store: recordsData,
        //   schema: {
        //     schemaVersion: 1,
        //     storeVersion: 4,
        //     recordVersions: {
        //       asset: {
        //         version: 1,
        //         subTypeKey: "type",
        //         subTypeVersions: { image: 2, video: 2, bookmark: 0 },
        //       },
        //       camera: { version: 1 },
        //       document: { version: 2 },
        //       instance: { version: 21 },
        //       instance_page_state: { version: 5 },
        //       page: { version: 1 },
        //       shape: {
        //         version: 3,
        //         subTypeKey: "type",
        //         subTypeVersions: {
        //           geo: 7,
        //           text: 1,
        //           bookmark: 1,
        //           draw: 1,
        //           image: 2,
        //           video: 1,
        //         },
        //       },
        //       instance_presence: { version: 5 },
        //       pointer: { version: 1 },
        //     },
        //   },
        // };
        // await loadSnapshot(store, snapshot);

        console.log("Store loaded successfully with records:", {
          recordCount: Object.keys(store.allRecords()).length,
          pageIds: Object.keys(records).filter((id) => id.startsWith("page:")),
        });
      } catch (e) {
        console.error("Failed to load snapshot:", e);
        return;
      }
      return store;
    } catch (e) {
      console.error("Failed to create store from file data", e);
      return;
    }
  }

  private createReactRoot(entryPoint: Element, store: TLStore) {
    const root = createRoot(entryPoint);
    root.render(
      <React.StrictMode>
        <TldrawPreviewComponent
          store={store}
          isReadonly={false}
          plugin={this.plugin}
        />
      </React.StrictMode>,
    );
    return root;
  }

  protected async setStore(store: TLStore) {
    console.log("setStore", store);

    // Clean up old store
    // if (this.store) {
    //   try {
    //     this.store.dispose();
    //   } catch (e) {
    //     console.error("Failed to dispose old store", e);
    //   }
    // }

    // Set new store
    this.store = store;

    // Refresh view
    if (this.tldrawContainer) {
      console.log("refreshView was called");
      await this.refreshView();
    }
  }

  private async refreshView() {
    if (!this.store) return;

    // Safely cleanup existing React root
    if (this.reactRoot) {
      try {
        // Check if container still exists and has children before unmounting
        const container = this.tldrawContainer;
        if (container && container.hasChildNodes()) {
          this.reactRoot.unmount();
        }
      } catch (e) {
        console.error("Failed to unmount React root", e);
      }
      this.reactRoot = undefined;
    }

    // Only create new root if container exists
    const container = this.tldrawContainer;
    if (container) {
      this.reactRoot = this.createReactRoot(container, this.store);
    }
  }

  registerOnUnloadFile(callback: () => void) {
    this.onUnloadCallbacks.push(callback);
  }

  async onUnloadFile(file: TFile): Promise<void> {
    // Run all unload callbacks
    const callbacks = [...this.onUnloadCallbacks];
    this.onUnloadCallbacks = [];
    callbacks.forEach((cb) => cb());

    return super.onUnloadFile(file);
  }

  async onClose() {
    await super.onClose();
    // Safely cleanup React root
    if (this.reactRoot) {
      try {
        const container = this.tldrawContainer;
        if (container && container.hasChildNodes()) {
          this.reactRoot.unmount();
        }
      } catch (e) {
        console.error("Failed to unmount React root", e);
      }
      this.reactRoot = undefined;
    }

    if (this.store) {
      try {
        this.store.dispose();
      } catch (e) {
        console.error("Failed to dispose store", e);
      }
      this.store = undefined;
    }
  }
}
