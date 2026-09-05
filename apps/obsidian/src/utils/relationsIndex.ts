import { TAbstractFile, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { RelationInstance } from "~/types";
import { getRelationsFilePath, loadRelations } from "./relationsStore";
import { buildEndpointIndex, collectRelations } from "./relationsEndpointIndex";

/**
 * In-memory view of relations.json.
 *
 * Reading relations straight from disk costs a full vault file read plus a JSON
 * parse per call, which is fine for the Discourse Context panel but not for
 * anything that renders per link. This keeps a parsed snapshot so callers on a
 * render path can ask a synchronous question and get an answer.
 *
 * The snapshot is rebuilt from the vault's own modify/create/delete events, so
 * writes made through saveRelations and edits arriving over sync are picked up
 * the same way, without relationsStore needing to know this exists.
 */
export class RelationsIndex {
  private plugin: DiscourseGraphPlugin;
  private index: Map<string, RelationInstance[]> | null = null;
  private inFlight: Promise<void> | null = null;
  private subscribers = new Set<() => void>();
  /**
   * Bumped on every invalidation. A load that started before the bump is stale
   * by the time it resolves, so it must not overwrite a newer snapshot —
   * relations.json being modified mid-read is the normal case here, not an edge
   * one, since saving a relation triggers exactly that.
   */
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

    void this.ensureLoaded();
  }

  unload(): void {
    this.subscribers.clear();
    this.index = null;
    this.inFlight = null;
    this.generation += 1;
  }

  /**
   * Notifies when the snapshot changes, so a caller that rendered against a
   * cold or stale index can render again. Returns an unsubscribe function.
   */
  onChange(subscriber: () => void): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  isReady(): boolean {
    return this.index !== null;
  }

  async ensureLoaded(): Promise<void> {
    if (this.index !== null) return;
    if (this.inFlight) return this.inFlight;

    const generation = this.generation;
    this.inFlight = (async () => {
      const relationsFile = await loadRelations(this.plugin);
      if (generation !== this.generation) return;
      this.index = buildEndpointIndex(relationsFile.relations ?? {});
      this.inFlight = null;
      this.notify();
    })();

    return this.inFlight;
  }

  /** Drops the snapshot and reloads it. */
  async refresh(): Promise<void> {
    this.invalidate();
    await this.ensureLoaded();
  }

  /**
   * Relations touching any of `endpointIds`.
   *
   * Returns an empty array when the snapshot is cold and schedules a load;
   * subscribers are notified once it lands. Callers on a render path should
   * treat an empty result as "nothing to draw yet" rather than "no relations".
   */
  getRelationsForEndpointIds(
    endpointIds: Iterable<string>,
  ): RelationInstance[] {
    if (this.index === null) {
      void this.ensureLoaded();
      return [];
    }
    return collectRelations({ index: this.index, endpointIds });
  }

  private invalidate(): void {
    this.generation += 1;
    this.index = null;
    this.inFlight = null;
    void this.ensureLoaded();
  }

  private notify(): void {
    for (const subscriber of this.subscribers) subscriber();
  }
}
