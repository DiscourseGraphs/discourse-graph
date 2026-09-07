import { TAbstractFile, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { RelationInstance } from "~/types";
import { getRelationsFilePath, loadRelations } from "./relationsStore";
import { buildEndpointIndex, collectRelations } from "./relationsEndpointIndex";

/**
 * Parsed snapshot of relations.json so a render path can ask synchronously,
 * rebuilt from vault events (which covers our own writes and sync alike).
 */
export class RelationsIndex {
  private plugin: DiscourseGraphPlugin;
  private index: Map<string, RelationInstance[]> | null = null;
  private inFlight: Promise<void> | null = null;
  private stale = false;
  private unloaded = false;
  /** Lets a ViewPlugin, which only sees transactions, detect a changed snapshot. */
  private version = 0;
  private subscribers = new Set<() => void>();
  /** Guards against a load that started before an invalidation overwriting a newer one. */
  private generation = 0;

  constructor(plugin: DiscourseGraphPlugin) {
    this.plugin = plugin;
  }

  initialize(): void {
    const invalidateIfRelationsFile = (file: TAbstractFile): void => {
      if (!(file instanceof TFile)) return;
      if (file.path !== getRelationsFilePath()) return;
      this.invalidate();
    };

    const { vault } = this.plugin.app;
    this.plugin.registerEvent(vault.on("modify", invalidateIfRelationsFile));
    this.plugin.registerEvent(vault.on("create", invalidateIfRelationsFile));
    this.plugin.registerEvent(vault.on("delete", invalidateIfRelationsFile));
    // Both directions: the file moving out of the root, and one moving in.
    this.plugin.registerEvent(
      vault.on("rename", (file, oldPath) => {
        if (oldPath === getRelationsFilePath()) this.invalidate();
        else invalidateIfRelationsFile(file);
      }),
    );

    void this.ensureLoaded();
  }

  unload(): void {
    this.unloaded = true;
    this.subscribers.clear();
    this.index = null;
    this.inFlight = null;
    this.generation += 1;
  }

  /** Changes whenever the snapshot is replaced; see the field comment. */
  getVersion(): number {
    return this.version;
  }

  /** Fires when the snapshot changes. Returns an unsubscribe function. */
  onChange(subscriber: () => void): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  async ensureLoaded(): Promise<void> {
    if (this.unloaded) return;
    if (this.index !== null && !this.stale) return;
    if (this.inFlight) return this.inFlight;

    const generation = this.generation;
    this.inFlight = (async () => {
      try {
        const relationsFile = await loadRelations(this.plugin);
        // Superseded mid-read; the invalidation already scheduled a reload.
        if (generation !== this.generation || this.unloaded) return;
        this.index = buildEndpointIndex(relationsFile.relations ?? {});
        this.stale = false;
        this.version += 1;
      } finally {
        // Every path, or ensureLoaded hands out a settled promise forever.
        this.inFlight = null;
      }
      // The skipped invalidation above still needs a load of its own.
      if (this.stale && !this.unloaded) {
        void this.ensureLoaded();
        return;
      }
      this.notify();
    })();

    return this.inFlight;
  }

  /**
   * Empty while cold, so treat that as "not loaded yet", not "no relations".
   * Never schedules a load: that would make notify -> re-render -> read loop.
   */
  getRelationsForEndpointIds(
    endpointIds: Iterable<string>,
  ): RelationInstance[] {
    if (this.index === null) return [];
    return collectRelations({ index: this.index, endpointIds });
  }

  /** Keeps the old snapshot while reloading, so badges do not flash to 0. */
  private invalidate(): void {
    this.generation += 1;
    this.inFlight = null;
    this.stale = true;
    void this.ensureLoaded();
  }

  private notify(): void {
    for (const subscriber of this.subscribers) subscriber();
  }
}
