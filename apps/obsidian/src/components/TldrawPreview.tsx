import { TextFileView, TFile, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import type DiscourseGraphPlugin from "~/index";
import { Root, createRoot } from "react-dom/client";
import { TldrawPreviewComponent } from "./TldrawPreviewComponent";
import { TLStore, createTLStore, loadSnapshot } from "tldraw";

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

  async onOpen() {
    const container = this.containerEl.children[1];
    if (!container) return;

    container.empty();
    container.addClass("tldraw-view-content");
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);

    const fileData = await this.app.vault.read(file);
    console.log("onLoadFile", file.path, fileData?.length);

    // Create store from file data
    const store = await this.createStore(fileData);
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

      const store = createTLStore();
      console.log("store created", store);
      loadSnapshot(store, data.raw);
      return store;
    } catch (e) {
      console.error("Failed to create store from file data", e);
      return;
    }
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
    await this.refreshView();
  }

  private async refreshView() {
    console.log("refreshView", this.store);
    const container = this.containerEl.children[1];
    if (!container) return;

    // Clean up old React root
    if (this.reactRoot) {
      try {
        this.reactRoot.unmount();
      } catch (e) {
        console.error("Failed to unmount React root", e);
      }
      this.reactRoot = undefined;
    }

    // Create new React root and render
    try {
      const reactContainer = container.createDiv();
      reactContainer.style.flex = "1";
      reactContainer.style.height = "100%";

      this.reactRoot = createRoot(reactContainer);
      this.reactRoot.render(
        <TldrawPreviewComponent
          plugin={this.plugin}
          store={this.store!}
          isReadonly={true}
        />,
      );
    } catch (e) {
      console.error("Failed to refresh view", e);
      container.createEl("div", { text: "Failed to initialize canvas view" });
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
