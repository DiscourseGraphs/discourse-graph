import type { ColumnRow } from "@repo/database/inputTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";

type Concept = ColumnRow<"Concept">;

// `max_rows` in supabase/config.toml. Past it, rows are dropped silently.
const PAGE_SIZE = 1000;

// `.in()` filters go in the GET URL, which caps the ids per request.
const ID_BATCH_SIZE = 200;

export const fetchAllPages = async <Row>(
  fetchPage: (
    start: number,
    end: number,
  ) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
): Promise<Row[]> => {
  const rows: Row[] = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const response = await fetchPage(start, start + PAGE_SIZE - 1);
    if (response.error) throw new Error(response.error.message);
    const page = response.data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
};

export const fetchConceptsByIds = async (
  supabase: DGSupabaseClient,
  ids: number[],
): Promise<Record<number, Concept>> => {
  const concepts: Record<number, Concept> = {};
  for (let start = 0; start < ids.length; start += ID_BATCH_SIZE) {
    const response = await supabase
      .from("Concept")
      .select()
      .in("id", ids.slice(start, start + ID_BATCH_SIZE));
    if (response.error) throw new Error(response.error.message);
    for (const concept of response.data) concepts[concept.id] = concept;
  }
  return concepts;
};

// The visible instances of a node type or relation type.
export const fetchInstances = (
  supabase: DGSupabaseClient,
  schemaId: number,
): Promise<Concept[]> =>
  fetchAllPages((start, end) =>
    supabase
      .from("Concept")
      .select()
      .eq("schema_id", schemaId)
      .eq("is_schema", false)
      .order("id")
      .range(start, end),
  );

// Titles are the `direct` content; `Concept.name` is a file path in Obsidian.
export const fetchSpaceTitles = async (
  supabase: DGSupabaseClient,
  spaceId: number,
): Promise<Map<string, string>> => {
  const rows = await fetchAllPages((start, end) =>
    supabase
      .from("Content")
      .select("id, source_local_id, text")
      .eq("space_id", spaceId)
      .eq("variant", "direct")
      .order("id")
      .range(start, end),
  );
  return new Map(
    rows
      .filter((row) => row.source_local_id !== null)
      .map((row) => [row.source_local_id!, row.text]),
  );
};
