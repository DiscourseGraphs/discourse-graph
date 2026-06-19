import type { Enums } from "./dbTypes";

export type Platform = Enums<"Platform">; // "Roam" | "Obsidian"

export type ContentVariant = Enums<"ContentVariant">;

export const SHARED_NODE_CONTENT_VARIANTS = [
  "direct",
  "full",
] as const satisfies readonly ContentVariant[];

export const FULL_CONTENT_FORMAT = "text/markdown";

export type CrossAppNodeType = {
  /**
   * Source-space schema Concept id (`Concept.source_local_id` where
   * `is_schema = true`). Destination apps use this to map or create a local
   * node type.
   */
  sourceLocalId: string;
  label: string;
};

export type CrossAppNodeContent = {
  direct: { value: string };
  full: {
    /**
     * Contract media type for `full.value`; current Content rows store the
     * markdown in `text`, not in a typed media column.
     */
    format: typeof FULL_CONTENT_FORMAT;
    value: string;
  };
};

export type CrossAppNodeIdentity = {
  sourceApp: Platform;
  /**
   * Use `Space.url`, not numeric `Space.id`, because `Space.id` is local to the
   * receiving database.
   */
  sourceSpace: { url: string; name: string };
  sourceLocalId: string;
  /** Stable source identity derived from `sourceSpace.url` + `sourceLocalId`. */
  rid: string;
};

export type CrossAppNode = CrossAppNodeIdentity & {
  nodeType: CrossAppNodeType;
  content: CrossAppNodeContent;
  /**
   * Source modified timestamp, or latest required `Content.last_modified` when
   * deriving from persisted `direct` and `full` rows.
   */
  sourceModifiedAt: string;
};
