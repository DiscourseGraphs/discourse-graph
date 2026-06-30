import type { contentTypes } from "@repo/content-model";

export type CrossAppNode = {
  sourceApp: "roam" | "obsidian";
  /**
   * Stable source-space id. Maps to `Space.url`, not numeric `Space.id`.
   */
  sourceSpaceId: string;
  sourceSpaceName: string;
  /**
   * Node id inside the source app/space.
   * Roam: page/block UID.
   * Obsidian: nodeInstanceId.
   */
  sourceNodeId: string;
  sourceNodeRid: string;
  nodeType: {
    /**
     * Node type/schema id inside the source app/space.
     * Maps to the schema Concept's `source_local_id`.
     */
    sourceNodeTypeId: string;
    label: string;
  };
  content: {
    direct: { value: string };
    full: {
      /**
       * Contract media type for `full.value`; current Content rows store the
       * markdown in `text`, not in a typed media column.
       */
      format: typeof contentTypes.markdown;
      value: string;
    };
  };
  /**
   * Source modified timestamp, or latest required `Content.last_modified` when
   * deriving from persisted `direct` and `full` rows.
   */
  sourceModifiedAt: string;
};
