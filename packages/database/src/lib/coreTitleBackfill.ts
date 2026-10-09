export const CORE_TITLE_PROBE_SELECT =
  "source_local_id, core_title:literal_content->>core_title";

export type CoreTitleProbeRow = {
  source_local_id: string | null;
  core_title: string | null;
};

export const partitionByCoreTitle = (
  rows: CoreTitleProbeRow[],
): { missingCoreTitleIds: Set<string>; withCoreTitleCount: number } => {
  const missingCoreTitleIds = new Set<string>();
  let withCoreTitleCount = 0;
  for (const row of rows) {
    if (row.source_local_id === null) continue;
    if (row.core_title === null) {
      missingCoreTitleIds.add(row.source_local_id);
    } else {
      withCoreTitleCount += 1;
    }
  }
  return { missingCoreTitleIds, withCoreTitleCount };
};
