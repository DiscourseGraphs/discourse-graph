/**
 * A node type schema's title format currently lives in two places in the
 * concept's literal_content: the top-level `format` key (written by Roam)
 * and `source_data.format` (written by Obsidian).
 *
 * The top-level key is the contract and is always authoritative; the nested
 * key is read only as a fallback. This dual read is temporary and goes away
 * once Obsidian writes the top-level key and existing rows are backfilled
 * (Post-V0 Roam-Obsidian sync architecture).
 */
export const resolveSchemaFormat = ({
  format,
  sourceDataFormat,
}: {
  format?: string | null;
  sourceDataFormat?: string | null;
}): string => format || sourceDataFormat || "";
