import { TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import { Root, createRoot } from "react-dom/client";
import { TldrawPreviewComponent } from "./TldrawViewComponent";
import { defaultShapeUtils, TLStore } from "tldraw";
import React from "react";
import DiscourseGraphPlugin from "~/index";
import { processInitialData, TLData } from "~/utils/tldraw";
import { ObsidianTLAssetStore } from "~/utils/assetStore";

export class TldrawView extends TextFileView {
  plugin: DiscourseGraphPlugin;
  private reactRoot?: Root;
  private store: TLStore | null = null;
  private assetStore: ObsidianTLAssetStore | null = null;
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

  setViewData(data: string, _clear: boolean): void {
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
    this.addAction("file-text", "View as markdown", () =>
      this.leaf.setViewState({
        type: "markdown",
        state: this.leaf.view.getState(),
      }),
    );
  }

  async onOpen() {
    const container = this.tldrawContainer;
    if (!container) return;

    container.empty();
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);

    const fileData = await this.app.vault.read(file);

    const assetStore = new ObsidianTLAssetStore(
      `tldraw-${encodeURIComponent(file.path)}`,
      {
        app: this.app,
        file,
      },
    );
    const store = this.createStore(fileData, assetStore);

    if (!store) {
      console.warn("No tldraw data found in file");
      return;
    }

    this.assetStore = assetStore;
    await this.setStore(store);
  }

  private createStore(
    fileData: string,
    assetStore: ObsidianTLAssetStore,
  ): TLStore | undefined {
    try {
      const match = fileData.match(
        /```json !!!_START_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!([\s\S]*?)!!!_END_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!\n```/,
      );

      if (!match?.[1]) {
        console.warn("No tldraw data found in file");
        return;
      }

      const data = JSON.parse(match[1]) as TLData;
      if (!data.raw) {
        console.warn("Invalid tldraw data format - missing raw field");
        return;
      }

      const { store } = processInitialData(data, assetStore, {
        app: this.app,
        canvasFile: this.file!,
        plugin: this.plugin,
      });

      return store;
    } catch (e) {
      console.error("Failed to create store from file data", e);
      return;
    }
  }

  private assertInitialized(): void {
    if (!this.file) throw new Error("TldrawView not initialized: missing file");
    if (!this.assetStore)
      throw new Error("TldrawView not initialized: missing assetStore");
    if (!this.store)
      throw new Error("TldrawView not initialized: missing store");
  }

  private createReactRoot(entryPoint: Element, store: TLStore) {
    const root = createRoot(entryPoint);
    if (!this.file) throw new Error("TldrawView not initialized: missing file");
    if (!this.assetStore)
      throw new Error("TldrawView not initialized: missing assetStore");
    if (!this.store)
      throw new Error("TldrawView not initialized: missing store");

    if (!this.assetStore) {
      console.warn("Asset store is not set");
      return;
    }

    root.render(
      <React.StrictMode>
        <TldrawPreviewComponent
          store={store}
          plugin={this.plugin}
          file={this.file}
          assetStore={this.assetStore}
        />
      </React.StrictMode>,
    );
    return root;
  }

  protected async setStore(store: TLStore) {
    if (this.store) {
      try {
        this.store.dispose();
      } catch (e) {
        console.error("Failed to dispose old store", e);
      }
    }

    this.store = store;
    if (this.tldrawContainer) {
      await this.refreshView();
    }
  }

  private async refreshView() {
    if (!this.store) return;

    if (this.reactRoot) {
      try {
        const container = this.tldrawContainer;
        if (container?.hasChildNodes()) {
          this.reactRoot.unmount();
        }
      } catch (e) {
        console.error("Failed to unmount React root", e);
      }
      this.reactRoot = undefined;
    }

    const container = this.tldrawContainer;
    if (container) {
      this.reactRoot = this.createReactRoot(container, this.store);
      await new Promise((resolve) => setTimeout(resolve, 0)); // Wait for React to render
    }
  }

  registerOnUnloadFile(callback: () => void) {
    this.onUnloadCallbacks.push(callback);
  }

  async onUnloadFile(file: TFile): Promise<void> {
    const callbacks = [...this.onUnloadCallbacks];
    this.onUnloadCallbacks = [];
    callbacks.forEach((cb) => cb());

    if (this.assetStore) {
      this.assetStore.dispose();
      this.assetStore = null;
    }

    return super.onUnloadFile(file);
  }

  async onClose() {
    await super.onClose();

    if (this.reactRoot) {
      try {
        const container = this.tldrawContainer;
        if (container?.hasChildNodes()) {
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
      this.store = null;
    }

    if (this.assetStore) {
      this.assetStore.dispose();
      this.assetStore = null;
    }
  }
}