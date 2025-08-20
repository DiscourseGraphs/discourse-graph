import { App, TFile, TAbstractFile, debounce, FrontMatterCache } from "obsidian";
import DiscourseGraphPlugin from "~/index";
import {
  getFrontmatterForFile,
  getNodeTypeById,
  getNodeTypeIdFromFrontmatter,
} from "~/components/canvas/shapes/discourseNodeShapeUtils";
import { resolveLinkedFileFromSrc } from "./assetStore";

/**
 * A lightweight snapshot of the data needed to render a canvas discourse node.
 *
 * Each snapshot represents the current derived state of the linked Obsidian file
 * for a TLDraw shape `src` (asset-like string). It is safe to read on the client
 * and designed to be stable for UI consumption.
 */
export interface NodeSnapshot {
  title: string;
  nodeTypeId: string | null;
  nodeTypeName: string;
  color: string;
  /** Raw frontmatter cache for advanced consumers */
  frontmatter: FrontMatterCache | null;
  /** True while the snapshot is being (re)resolved */
  isLoading: boolean;
  error?: string;
}

type Listener = () => void;

type StoreCtx = {
  app: App;
  canvasFile: TFile;
  plugin: DiscourseGraphPlugin;
};

/**
 * TLDraw shape `src` key. Example: "asset:obsidian.blockref.<id>".
 */
type SrcKey = string;

type Entry = {
  snapshot: NodeSnapshot;
  listeners: Set<Listener>;
  /** Cached `TFile.path` for efficient matching on vault events */
  linkedPath: string | null;
};

/**
 * Public API for the canvas node snapshot store.
 *
 * - get: read the latest snapshot for a given `src`
 * - subscribe: register a listener for changes to a given `src`
 * - dispose: remove global listeners and clear all internal state
 */
export type NodeSnapshotStore = {
  get: (src: SrcKey | null) => NodeSnapshot;
  subscribe: (src: SrcKey | null, callback: Listener) => () => void;
  dispose: () => void;
};

const DEFAULT_SNAPSHOT: NodeSnapshot = {
  title: "...",
  nodeTypeId: null,
  nodeTypeName: "",
  color: "transparent",
  frontmatter: null,
  isLoading: true,
};

/**
 * Create a per-canvas store that derives and caches snapshots for TLDraw discourse shape nodes.
 *
 * The store listens to Obsidian vault and metadataCache events and will
 * automatically refresh affected snapshots when linked files or the canvas
 * change, debounced to prevent excessive work.
 */
export const createNodeSnapshotStore = (ctx: StoreCtx): NodeSnapshotStore => {
  const { app, canvasFile, plugin } = ctx;

  const entries = new Map<SrcKey, Entry>();

  /** Notify subscribers for a specific `src`. */
  const emit = (src: SrcKey) => {
    const entry = entries.get(src);
    if (!entry) return;
    for (const callback of entry.listeners) callback();
  };

  /** Shallow compare snapshots to avoid unnecessary re-renders. */
  const shallowEqualSnapshot = (a: NodeSnapshot, b: NodeSnapshot) => {
    return (
      a.title === b.title &&
      a.nodeTypeId === b.nodeTypeId &&
      a.nodeTypeName === b.nodeTypeName &&
      a.color === b.color &&
      a.isLoading === b.isLoading &&
      a.error === b.error &&
      // frontmatter is potentially big; compare by reference to avoid churn
      a.frontmatter === b.frontmatter
    );
  };

  /**
   * Merge partial updates into an entry and emit if something meaningful changed.
   * Keeps a cached `linkedPath` to quickly identify relevant vault events.
   */
  const updateEntry = (
    src: SrcKey,
    next: Partial<NodeSnapshot> & { linkedPath?: string | null },
  ) => {
    const prev = entries.get(src);
    const prevSnap = prev?.snapshot ?? DEFAULT_SNAPSHOT;
    const snapshot: NodeSnapshot = {
      ...prevSnap,
      ...next,
    };
    const linkedPath = next.linkedPath ?? prev?.linkedPath ?? null;
    if (!prev) {
      entries.set(src, {
        snapshot,
        listeners: new Set(),
        linkedPath,
      });
      emit(src);
      return;
    }
    if (
      !shallowEqualSnapshot(prev.snapshot, snapshot) ||
      prev.linkedPath !== linkedPath
    ) {
      prev.snapshot = snapshot;
      prev.linkedPath = linkedPath;
      emit(src);
    }
  };

  /**
   * Resolve and refresh the snapshot for a single `src`.
   * Handles unlink, metadata derivation, and error cases.
   */
  const resolveForSrc = async (src: SrcKey) => {
    try {
      updateEntry(src, { isLoading: true, error: undefined });
      const linked = await resolveLinkedFileFromSrc({
        app,
        canvasFile,
        src,
      });
      if (!linked) {
        updateEntry(src, {
          isLoading: false,
          title: "(unlinked)",
          nodeTypeId: null,
          nodeTypeName: "",
          color: "transparent",
          frontmatter: null,
          linkedPath: null,
        });
        return;
      }

      const fm = getFrontmatterForFile(app, linked);
      const nodeTypeId = getNodeTypeIdFromFrontmatter(fm);
      const nodeType = getNodeTypeById(plugin, nodeTypeId);

      updateEntry(src, {
        isLoading: false,
        title: linked.basename,
        nodeTypeId,
        nodeTypeName: nodeType?.name ?? "",
        color: nodeType?.color ?? "white",
        frontmatter: fm,
        linkedPath: linked.path,
      });
    } catch (err) {
      updateEntry(src, {
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  /** Debounced refresh of all known snapshots, used for canvas/meta changes. */
  const debouncedRefreshAll = debounce(
    async () => {
      const srcs = Array.from(entries.keys());
      await Promise.all(srcs.map((src) => resolveForSrc(src)));
    },
    100,
    true,
  );

  // Global listeners scoped to this store instance
  const onModify = app.vault.on("modify", (file: TAbstractFile) => {
    if (!(file instanceof TFile)) return;
    for (const [src, entry] of entries) {
      if (entry.linkedPath && file.path === entry.linkedPath) {
        void resolveForSrc(src);
      }
    }
  });

  const onRename = app.vault.on(
    "rename",
    (file: TAbstractFile, oldPath: string) => {
      console.log("onRename", file, oldPath);
      if (!(file instanceof TFile)) return;
      for (const [src, entry] of entries) {
        if (
          entry.linkedPath &&
          (oldPath === entry.linkedPath || file.path === entry.linkedPath)
        ) {
          void resolveForSrc(src);
        }
      }
    },
  );

  const onCanvasMetaChanged = app.metadataCache.on("changed", (file: TFile) => {
    if (file.path === canvasFile.path) {
      // Blockref mapping in canvas may have changed
      void debouncedRefreshAll();
    }
  });

  const onResolved = app.metadataCache.on("resolved", () => {
    void debouncedRefreshAll();
  });

  return {
    /** Read the latest snapshot for a given `src`. */
    get: (src: SrcKey | null) => {
      if (!src) return DEFAULT_SNAPSHOT;
      const entry = entries.get(src);
      return entry?.snapshot ?? DEFAULT_SNAPSHOT;
    },
    /** Subscribe to changes for a given `src`. Returns an unsubscribe function. */
    subscribe: (src: SrcKey | null, callback: Listener) => {
      if (!src) return () => {};
      let entry = entries.get(src);
      if (!entry) {
        entry = {
          snapshot: DEFAULT_SNAPSHOT,
          listeners: new Set(),
          linkedPath: null,
        };
        entries.set(src, entry);
        void resolveForSrc(src);
      }
      entry.listeners.add(callback);
      return () => {
        const e = entries.get(src);
        if (!e) return;
        e.listeners.delete(callback);
        if (e.listeners.size === 0) {
          // Keep entry cached for now; could add LRU eviction if needed
        }
      };
    },
    /** Remove global listeners and clear state. */
    dispose: () => {
      try {
        app.vault.offref(onModify);
      } catch {
        /* offref may throw if already removed; safe to ignore */
      }
      try {
        app.vault.offref(onRename);
      } catch {
        /* offref may throw if already removed; safe to ignore */
      }
      try {
        app.metadataCache.offref(onCanvasMetaChanged);
      } catch {
        /* offref may throw if already removed; safe to ignore */
      }
      try {
        app.metadataCache.offref(onResolved);
      } catch {
        /* offref may throw if already removed; safe to ignore */
      }
      entries.clear();
    },
  };
};


