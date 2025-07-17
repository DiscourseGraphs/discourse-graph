import { TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import type DiscourseGraphPlugin from "~/index";
import { Root, createRoot } from "react-dom/client";
import { TldrawPreviewComponent } from "./TldrawPreviewComponent";
import {
  TLRecord,
  TLStore,
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

    const store = await this.createStore(fileData);

    if (!store) {
      console.warn("No tldraw data found in file");
      return;
    }

    await this.setStore(store);
  }

  private async createStore(fileData: string): Promise<TLStore | undefined> {
    try {
      const match = fileData.match(
        /```json !!!_START_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!([\s\S]*?)!!!_END_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!\n```/,
      );

      if (!match?.[1]) {
        console.warn("No tldraw data found in file");
        return;
      }

      const data = JSON.parse(match[1]);
      if (!data.raw) {
        console.warn("Invalid tldraw data format - missing raw field");
        return;
      }

      const recordsData = Array.isArray(data.raw.records)
        ? data.raw.records.reduce(
            (
              acc: Record<string, TLRecord>,
              record: { id: string } & TLRecord,
            ) => {
              acc[record.id] = {
                ...record,
              };
              return acc;
            },
            {},
          )
        : data.raw.records;

      let store: TLStore;
      if (recordsData) {
        store = createTLStore({
          shapeUtils: defaultShapeUtils,
          initialData: recordsData,
        });
      } else {
        store = createTLStore({
          shapeUtils: defaultShapeUtils,
        });
        loadSnapshot(store, data.raw);
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
        if (container && container.hasChildNodes()) {
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
    }
  }

  registerOnUnloadFile(callback: () => void) {
    this.onUnloadCallbacks.push(callback);
  }

  async onUnloadFile(file: TFile): Promise<void> {
    const callbacks = [...this.onUnloadCallbacks];
    this.onUnloadCallbacks = [];
    callbacks.forEach((cb) => cb());

    return super.onUnloadFile(file);
  }

  async onClose() {
    await super.onClose();

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
