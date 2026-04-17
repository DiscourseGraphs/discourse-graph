import { TFile, TAbstractFile, EventRef } from "obsidian";
import { default as DiscourseGraphPlugin } from "~/index";
import {
  syncDiscourseNodeChanges,
  type ChangeType,
  cleanupOrphanedNodes,
} from "./syncDgNodesToSupabase";
import { getNodeTypeById } from "./typeUtils";

type QueuedChange = {
  filePath: string;
  changeTypes: Set<ChangeType>;
  oldPath?: string; // For rename operations
};

const DEBOUNCE_DELAY_MS = 5000; // 5 seconds

/**
 * FileChangeListener monitors Obsidian vault events for DG node changes
 * and queues them for sync to Supabase with debouncing.
 */
export class FileChangeListener {
  private plugin: DiscourseGraphPlugin;
  private changeQueue: Map<string, QueuedChange> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private eventRefs: EventRef[] = [];
  private metadataChangeCallback: ((file: TFile) => void) | null = null;
  private isProcessing = false;
  private hasPendingOrphanCleanup = false;
  private pendingCreates: Set<string> = new Set();

  constructor(plugin: DiscourseGraphPlugin) {
    this.plugin = plugin;
  }

  /**
   * Initialize the file change listener and register vault event handlers
   */
  initialize(): void {
    const createRef = this.plugin.app.vault.on(
      "create",
      (file: TAbstractFile) => {
        this.handleFileCreate(file);
      },
    );
    this.eventRefs.push(createRef);

    const modifyRef = this.plugin.app.vault.on(
      "modify",
      (file: TAbstractFile) => {
        this.handleFileModify(file);
      },
    );
    this.eventRefs.push(modifyRef);

    const deleteRef = this.plugin.app.vault.on(
      "delete",
      (file: TAbstractFile) => {
        this.handleFileDelete(file);
      },
    );
    this.eventRefs.push(deleteRef);

    const renameRef = this.plugin.app.vault.on(
      "rename",
      (file: TAbstractFile, oldPath: string) => {
        this.handleFileRename(file, oldPath);
      },
    );
    this.eventRefs.push(renameRef);

    this.metadataChangeCallback = (file: TFile) => {
      this.handleMetadataChange(file);
    };
    this.plugin.app.metadataCache.on("changed", this.metadataChangeCallback);
  }

  /**
   * Check if a file is a DG node (has nodeTypeId in frontmatter that matches a node type in settings)
   */
  private shouldSyncFile(file: TAbstractFile): boolean {
    if (!(file instanceof TFile)) {
      console.log(
        "[DG FileListener] shouldSyncFile: skip (not TFile)",
        file.path,
      );
      return false;
    }

    // Only process markdown files
    if (!file.path.endsWith(".md")) {
      console.log(
        "[DG FileListener] shouldSyncFile: skip (not .md)",
        file.path,
      );
      return false;
    }

    const cache = this.plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    const nodeTypeId = frontmatter?.nodeTypeId as string | undefined;

    if (!nodeTypeId || typeof nodeTypeId !== "string") {
      console.log(
        "[DG FileListener] shouldSyncFile: skip (no nodeTypeId in cache)",
        file.path,
      );
      return false;
    }

    if (frontmatter?.importedFromRid) {
      console.log(
        "[DG FileListener] shouldSyncFile: skip (importedFromRid present)",
        file.path,
      );
      return false;
    }

    const hasType = !!getNodeTypeById(this.plugin, nodeTypeId);
    console.log(
      "[DG FileListener] shouldSyncFile:",
      file.path,
      "nodeTypeId:",
      nodeTypeId,
      "hasType:",
      hasType,
    );
    return hasType;
  }

  /**
   * Handle file creation event
   */
  private handleFileCreate(file: TAbstractFile): void {
    if (!(file instanceof TFile)) {
      return;
    }

    if (!file.path.endsWith(".md")) {
      return;
    }

    this.pendingCreates.add(file.path);

    if (this.shouldSyncFile(file)) {
      this.queueChange(file.path, "title");
      this.queueChange(file.path, "content");
      this.pendingCreates.delete(file.path);
    }
  }

  /**
   * Handle file modification event
   */
  private handleFileModify(file: TAbstractFile): void {
    console.log("[DG FileListener] handleFileModify fired:", file.path);
    if (!this.shouldSyncFile(file)) {
      return;
    }

    this.queueChange(file.path, "content");
  }

  /**
   * Handle file deletion event (placeholder - log only)
   */
  private handleFileDelete(file: TAbstractFile): void {
    if (!(file instanceof TFile) || !file.path.endsWith(".md")) {
      return;
    }

    this.hasPendingOrphanCleanup = true;
    this.resetDebounceTimer();
  }

  /**
   * Handle file rename event
   */
  private handleFileRename(file: TAbstractFile, oldPath: string): void {
    if (!this.shouldSyncFile(file)) {
      return;
    }

    this.queueChange(file.path, "title", oldPath);
  }

  /**
   * Handle metadata changes (placeholder for relation metadata)
   */
  private handleMetadataChange(file: TFile): void {
    console.log(
      "[DG FileListener] handleMetadataChange fired:",
      file.path,
      "inPendingCreates:",
      this.pendingCreates.has(file.path),
    );
    if (!this.shouldSyncFile(file)) {
      return;
    }

    if (this.pendingCreates.has(file.path)) {
      this.queueChange(file.path, "title");
      this.queueChange(file.path, "content");
      this.pendingCreates.delete(file.path);
      return;
    }

    // Note: pendingCreates helps track files that are created -> added nodeTypeId -> synced to Supabase.
    // If a file is created -> added nodeTypeId manually, it won't be detected until the next global sync (onLoad).
  }

  /**
   * Queue a file change for sync
   */
  private queueChange(
    filePath: string,
    changeType: ChangeType,
    oldPath?: string,
  ): void {
    const existing = this.changeQueue.get(filePath);
    if (existing) {
      existing.changeTypes.add(changeType);
      if (oldPath && !existing.oldPath) {
        existing.oldPath = oldPath;
      }
    } else {
      this.changeQueue.set(filePath, {
        filePath,
        changeTypes: new Set([changeType]),
        oldPath,
      });
    }

    console.log(
      "[DG FileListener] queueChange:",
      filePath,
      changeType,
      "queue size:",
      this.changeQueue.size,
    );
    this.resetDebounceTimer();
  }

  /**
   * Reset the debounce timer
   */
  private resetDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.processQueue();
    }, DEBOUNCE_DELAY_MS);
  }

  /**
   * Process the queued changes and sync to Supabase
   */
  private async processQueue(): Promise<void> {
    console.log(
      "[DG FileListener] processQueue: isProcessing:",
      this.isProcessing,
      "queueSize:",
      this.changeQueue.size,
    );
    if (this.isProcessing) {
      console.log(
        "[DG FileListener] processQueue: already processing, skipping",
      );
      return;
    }

    if (this.changeQueue.size === 0 && !this.hasPendingOrphanCleanup) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process files one by one, removing from queue as we go
      const processedFiles: string[] = [];
      const failedFiles: string[] = [];

      while (this.changeQueue.size > 0) {
        // Get the first item from the queue
        const firstEntry = this.changeQueue.entries().next().value as
          | [string, QueuedChange]
          | undefined;

        if (!firstEntry) {
          break;
        }

        const [filePath, change] = firstEntry;

        try {
          console.log(
            "[DG FileListener] processQueue: syncing file:",
            filePath,
            "changeTypes:",
            Array.from(change.changeTypes),
          );
          const changeTypesByPath = new Map<string, ChangeType[]>();
          changeTypesByPath.set(filePath, Array.from(change.changeTypes));

          await syncDiscourseNodeChanges(this.plugin, changeTypesByPath);

          // Only remove from queue after successful processing
          this.changeQueue.delete(filePath);
          processedFiles.push(filePath);
          console.log("[DG FileListener] processQueue: success for:", filePath);
        } catch (error) {
          console.error(
            `Error processing file ${filePath}, will retry later:`,
            error,
          );
          // Remove from queue even on failure to prevent infinite retry loops
          // Failed files will be re-queued if they change again
          this.changeQueue.delete(filePath);
          failedFiles.push(filePath);
        }
      }

      console.log(
        "[DG FileListener] processQueue: done. processed:",
        processedFiles.length,
        "failed:",
        failedFiles,
      );
      if (this.hasPendingOrphanCleanup) {
        await cleanupOrphanedNodes(this.plugin);
        this.hasPendingOrphanCleanup = false;
      }
    } catch (error) {
      console.error("Error processing sync queue:", error);
      // Items that weren't processed remain in the queue for retry
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Cleanup event listeners
   */
  cleanup(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this.eventRefs.forEach((ref) => {
      this.plugin.app.vault.offref(ref);
    });
    this.eventRefs = [];

    if (this.metadataChangeCallback) {
      this.plugin.app.metadataCache.off(
        "changed",
        this.metadataChangeCallback as (...data: unknown[]) => unknown,
      );
      this.metadataChangeCallback = null;
    }

    this.changeQueue.clear();
    this.pendingCreates.clear();
    this.isProcessing = false;
  }
}
