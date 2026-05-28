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
  let offset = 0;
  const rows: Result[] = [];
  while (true) {
    const result = await query.range(offset, offset + limit);
    const { data, error } = result;
    if (error) return error;
    rows.push(...data);
    if (data.length < limit) break;
    offset += data.length;
  }
  return rows;
};
