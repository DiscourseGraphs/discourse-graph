import { difference, intersection } from "@repo/utils/setOperations";
import { type DiscourseNode } from "./getDiscourseNodes";

export const SCHEMA_FORMAT_PROBE_SELECT =
  "source_local_id, format:literal_content->>format";

type SchemaFormatProbeRow = {
  source_local_id: string | null;
  format: string | null;
};

export type SchemaFormatBackfill = {
  nodeTypeIdsToBackfill: Set<string>;
  withFormatCount: number;
  orphanedCount: number;
};

export const buildSchemaFormatBackfill = ({
  conceptRows,
  nodeTypes,
}: {
  conceptRows: SchemaFormatProbeRow[];
  nodeTypes: DiscourseNode[];
}): SchemaFormatBackfill => {
  const missingFormatIds = new Set<string>();
  let withFormatCount = 0;
  for (const row of conceptRows) {
    if (row.source_local_id === null) continue;
    if (row.format === null) {
      missingFormatIds.add(row.source_local_id);
    } else {
      withFormatCount += 1;
    }
  }
  const localTypeIds = new Set(nodeTypes.map((nodeType) => nodeType.type));
  return {
    nodeTypeIdsToBackfill: intersection(missingFormatIds, localTypeIds),
    withFormatCount,
    orphanedCount: difference(missingFormatIds, localTypeIds).size,
  };
};
