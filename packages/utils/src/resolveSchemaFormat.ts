/**
 * A node type schema's title format lives in two places in the concept's
 * literal_content: the top-level `format` key and `source_data.format`
 * (written by Obsidian). Nothing writes the top-level key yet: Roam starts
 * writing it with ENG-2158, and ENG-2175 backfills rows published before it.
 *
 * The top-level key is the contract and is always authoritative; the nested
 * key is read only as a fallback. The dual read is temporary and goes away
 * once Obsidian also writes the top-level key (a follow-up PR under Post-V0
 * Roam-Obsidian sync architecture) and existing rows are backfilled.
 */
export const resolveSchemaFormat = ({
  format,
  sourceDataFormat,
}: {
  format?: string | null;
  sourceDataFormat?: string | null;
}): string => format || sourceDataFormat || "";
