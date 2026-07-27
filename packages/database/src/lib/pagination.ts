import { PostgrestError, PostgrestFilterBuilder } from "@supabase/supabase-js";
import type { Database, Tables } from "@repo/database/dbTypes";

type TableName =
  | keyof Database["public"]["Tables"]
  | keyof Database["public"]["Views"];

type PGQuery<Name extends TableName, Result> = PostgrestFilterBuilder<
  { PostgrestVersion: "12" },
  Database["public"],
  Tables<Name>,
  Result[],
  Name
>;

export const getAllPages = async <Name extends TableName, Result>(
  query: PGQuery<Name, Result>,
  limit: number = 200,
): Promise<Result[] | PostgrestError> => {
  // note: Bypassing protections
  // eslint-disable-next-line
  if ((query as any).url.search.indexOf("order") < 0)
    throw new Error("Missing order clause on paginated query");
  let offset = 0;
  const rows: Result[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = await query.range(offset, offset + limit - 1);
    const { data, error } = result;
    if (error) return error;
    rows.push(...data);
    if (data.length < limit) break;
    offset += data.length;
  }
  return rows;
};
