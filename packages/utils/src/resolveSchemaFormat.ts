/**
 * A node type schema's title format lives in two places in the concept's
 * literal_content: the top-level `format` key and `source_data.format`
 * (written by Obsidian). Roam writes the top-level key as of ENG-2158, and
 * ENG-2175 backfills Roam rows published before it.
 *
 * The top-level key is the contract and is always authoritative; the nested
 * key is read only as a fallback. The dual read is temporary and goes away
 * once Obsidian also writes the top-level key (ENG-2208) and existing rows
 * are backfilled.
 */
export const resolveSchemaFormat = ({
  format,
  sourceDataFormat,
}: {
  format?: string | null;
  sourceDataFormat?: string | null;
}): string => format || sourceDataFormat || "";
