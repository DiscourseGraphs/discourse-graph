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
  private stale = false;
  private unloaded = false;
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
    this.unloaded = true;
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

  async ensureLoaded(): Promise<void> {
    if (this.unloaded) return;
    if (this.index !== null && !this.stale) return;
    if (this.inFlight) return this.inFlight;

    const generation = this.generation;
    this.inFlight = (async () => {
      try {
        const relationsFile = await loadRelations(this.plugin);
        // A newer invalidation landed mid-read, so this result is already out
        // of date; the reload it scheduled will supersede it.
        if (generation !== this.generation || this.unloaded) return;
        this.index = buildEndpointIndex(relationsFile.relations ?? {});
        this.stale = false;
      } finally {
        // Must clear on every path. Leaving it set would make ensureLoaded
        // hand out a settled promise forever, so the snapshot would stay stale
        // and every read would re-request a load that never runs.
        this.inFlight = null;
      }
      // An invalidation that arrived mid-read was skipped above; it still needs
      // a load of its own.
      if (this.stale && !this.unloaded) {
        void this.ensureLoaded();
        return;
      }
      this.notify();
    })();

    return this.inFlight;
  }

  /**
   * Relations touching any of `endpointIds`.
   *
   * Returns an empty array while the snapshot is still cold; subscribers are
   * notified once it lands. Callers on a render path should treat an empty
   * result as "nothing to draw yet" rather than "no relations".
   *
   * Deliberately does not schedule a load — initialize() and invalidate() are
   * the only things that do. Requesting one from a render path would make
   * notify -> re-render -> read cycle forever.
   */
  getRelationsForEndpointIds(
    endpointIds: Iterable<string>,
  ): RelationInstance[] {
    if (this.index === null) return [];
    return collectRelations({ index: this.index, endpointIds });
  }

  /**
   * Marks the snapshot for reload without discarding it.
   *
   * Dropping it outright would make every badge read 0 until the reload lands —
   * and since saving a relation writes relations.json, that flash would happen
   * on the very action the user just took. The previous counts are a better
   * answer for those few milliseconds than a wrong one.
   */
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
