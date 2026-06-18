import type { Enums } from "./dbTypes";

/**
 * Shared cross-app discourse-node content contract (MVP0).
 *
 * This is the payload that lets Roam and Obsidian discover, import and refresh
 * each other's discourse nodes. It is a typed *view* over data that already
 * persists through `@repo/database/inputTypes` (`LocalConceptDataInput` /
 * `LocalContentDataInput`) and the `upsert_concepts` / `upsert_content` RPCs —
 * it does NOT introduce a new persistence path. Build/parse the `rid` with the
 * helpers in `@repo/database/lib/rid`. The full spec — field-by-field mapping to
 * the Concept/Content tables and markdown fidelity limits — lives on Linear
 * issue ENG-1847.
 */

/** Source app a shared node originates from. Mirrors the DB `Platform` enum. */
export type Platform = Enums<"Platform">; // "Roam" | "Obsidian"

/** Persisted content scales. Mirrors the DB `ContentVariant` enum. */
export type ContentVariant = Enums<"ContentVariant">;

/**
 * The Content variants every shared node must persist:
 * - `direct`: the import-list title.
 * - `full`: a self-sufficient markdown body the destination can materialize
 *   without querying the source app.
 */
export const SHARED_NODE_CONTENT_VARIANTS = [
  "direct",
  "full",
] as const satisfies readonly ContentVariant[];

/**
 * MIME type of the `full` variant in MVP0. Markdown is the v0 content model;
 * atJSON is the planned v1 successor (F16). Keep this as the single place that
 * names the format so v1 does not have to hunt down hardcoded strings.
 */
export const FULL_CONTENT_FORMAT = "text/markdown";

/** Identity of the node-type schema the destination maps to / creates from. */
export type CrossAppNodeType = {
  /**
   * `source_local_id` of the node-type *schema* Concept in the source space
   * (the Concept with `is_schema = true`). Maps to
   * `LocalConceptDataInput.schema_represented_by_local_id` on the instance.
   */
  sourceLocalId: string;
  /** Human-readable node-type label, e.g. "Claim". */
  label: string;
};

/** The required content variants of a shared node. */
export type CrossAppNodeContent = {
  /** Import-list title. Persisted as the `direct` Content variant (`text`). */
  direct: { value: string };
  /**
   * Self-sufficient markdown body. Persisted as the `full` Content variant
   * (`text`); `format` is the contract-level media type for that text in MVP0.
   */
  full: { format: typeof FULL_CONTENT_FORMAT; value: string };
};

/**
 * Stable cross-app identity (F9). The triple
 * (`sourceApp`, `sourceSpace.url`, `sourceLocalId`) is equivalent to `rid`;
 * build/parse `rid` with `spaceUriAndLocalIdToRid` / `ridToSpaceUriAndLocalId`
 * from `@repo/database/lib/rid`. Duplicate-prevention and refresh must key on
 * this identity, never on the display title.
 */
export type CrossAppNodeIdentity = {
  sourceApp: Platform;
  /**
   * Source space: `Space.url` (portable cross-app id) and `Space.name`
   * (display). Do not use numeric `Space.id` as the payload identity; it is
   * local to the receiving database.
   */
  sourceSpace: { url: string; name: string };
  /** The node's `source_local_id` within its source space. */
  sourceLocalId: string;
  /** Stable cross-app id derived from (`sourceSpace.url`, `sourceLocalId`). */
  rid: string;
};

/** The shared cross-app discourse-node payload (discovery + import facing). */
export type CrossAppNode = CrossAppNodeIdentity & {
  nodeType: CrossAppNodeType;
  content: CrossAppNodeContent;
  /**
   * ISO-8601 source last-modified time. Use the source node modified timestamp,
   * or the latest `Content.last_modified` across the required `direct` and
   * `full` variants when deriving from persisted rows. Basis for freshness
   * (F13), refresh, and duplicate-prevention.
   */
  sourceModifiedAt: string;
};
