import { TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import type DiscourseGraphPlugin from "~/index";
import { Root, createRoot } from "react-dom/client";
import { TldrawPreviewComponent } from "./TldrawPreviewComponent";
import {
  ErrorBoundary,
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

      const store = createTLStore({
        shapeUtils: defaultShapeUtils,
      });
      console.log("store created", store);
      loadSnapshot(store, data.raw);
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
          isReadonly={true}
          plugin={this.plugin}
        />
      </React.StrictMode>,
    );
    return root;
  }

  protected async setStore(store: TLStore) {
    console.log("setStore", store);

    // Clean up old store
    if (this.store) {
      try {
        this.store.dispose();
      } catch (e) {
        console.error("Failed to dispose old store", e);
      }
    }

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

    // Clean up old React root
    if (this.reactRoot) {
      try {
        this.reactRoot.unmount();
      } catch (e) {
        console.error("Failed to unmount React root", e);
      }
      this.reactRoot = undefined;
    }

    console.log("tldrawContainer", this.tldrawContainer);
    console.log("store", this.store);

    // Create new React root and render
    this.reactRoot = this.createReactRoot(this.tldrawContainer!, this.store);
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
    // Cleanup React
    if (this.reactRoot) {
      try {
        this.reactRoot.unmount();
      } catch (e) {
        console.error("Failed to unmount React root", e);
      }
      this.reactRoot = undefined;
    }

    // Cleanup store
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
