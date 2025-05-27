import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { Database, Tables, TablesInsert } from "~/utils/supabase/types.gen";

export const known_embedding_tables: {
  [key: string]: {
    table_name: keyof Database["public"]["Tables"];
    table_size: number;
  };
} = {
  openai_text_embedding_3_small_1536: {
    table_name: "ContentEmbedding_openai_text_embedding_3_small_1536",
    table_size: 1536,
  },
};

const unique_key_re = /^Key \(([^\)]+)\)=\(([\^\)]+)\) already exists\.$/;
const unique_index_re =
  /duplicate key value violates unique constraint "(\w+)"/;
const foreign_key_re =
  /Keys? \(([^\)]+)\)=\(([^\)]+)\) (is|are) not present in table ("?\w+"?)./;
const foreign_constraint_re =
  /insert or update on table ("?\w+"?) violates foreign key constraint ("?\w+"?)/;

// const known_unique_keys: {
//   [key in keyof Database["public"]["Tables"]]: string[][]; // It should be keyof Tables<key>[][]
// } = {
//   Agent: [["id"]],
//   Account: [["platform_id", "account_local_id"], ["id"]],
//   AutomatedAgent: [["name", "version"], ["id"]],
//   Person: [["email"], ["orcid"], ["id"]],
//   Concept: [["space_id", "name"], ["id"]],
//   Document: [["space_id", "source_local_id"], ["url"], ["id"]],
//   Content: [["space_id", "source_local_id"], ["id"]],
//   Platform: [["url"], ["id"]],
//   Space: [["url"], ["id"]],
//   ContentEmbedding_openai_text_embedding_3_small_1536: [["target_id"]],
//   concept_contributors: [[""]],
// };

export type BaseEntityResult = {
  error: string | null;
  details?: string; // For detailed error messages, e.g., from Supabase
  status: number; // HTTP status code to suggest
};

const processSupabaseError = (
  error: PostgrestError,
  tableName: string,
): BaseEntityResult => {
  console.error(`Error inserting new ${tableName}:`, error);
  if (error.code === "23505") {
    // Handle race condition: unique constraint violation (PostgreSQL error code '23505')
    console.warn(
      `Unique constraint violation on ${tableName} insert .\nError is ${error.message}, ${error.hint}.`,
    );
    const dup_key_data = unique_key_re.exec(error.hint);
    if (dup_key_data !== null && dup_key_data.length > 1) {
      const uniqueOn = dup_key_data[1]!.split(",").map((x) => x.trim());
      if (uniqueOn.length === 0) {
        const idx_data = unique_index_re.exec(error.message);
        return {
          error:
            idx_data === null
              ? "Could not identify the keys or index of the unique constraint"
              : `Could not identify the keys of the unique key index ${idx_data[1]}`,
          details: error.message,
          status: 400,
        };
      }
    }
    return {
      error: `Unique constraint violation on ${tableName} insert, and re-fetch failed to find the entity.`,
      details: error.message,
      status: 409, // Conflict, and couldn't resolve by re-fetching
    };
  }
  if (error.code === "23503") {
    // Handle foreign key constraint violations (PostgreSQL error code '23503')
    const fkey_data = foreign_key_re.exec(error.hint);
    const constraint_data = foreign_constraint_re.exec(error.message);
    console.warn(
      `Foreign violation on ${tableName}, constraint ${constraint_data ? constraint_data[2] : "unknown"}, keys ${fkey_data ? fkey_data[1] : "unknown"}`,
    );
    return {
      error:
        fkey_data === null
          ? constraint_data === null
            ? "Could not identify the missing foreign key"
            : `Foreign key constraint ${constraint_data[2]} violated`
          : `Foreign key ${fkey_data[1]} is missing value ${fkey_data[2]}`,
      details: error.message,
      status: 400,
    };
  }

  return {
    error: `Database error ${error.code} while upserting in ${tableName}.`,
    details: error.message,
    status: 500,
  };
};

export type GetOrCreateEntityResult<T> = BaseEntityResult & {
  entity: T | null;
  created: boolean;
};

/**
 * Generic function to get an entity or create it if it doesn't exist.
 * Handles common race conditions for unique constraint violations.
 *
 * @param supabase Supabase client instance.
 * @param tableName The name of the table.
 * @param insertData Data to upsert
 * @param uniqueOn The expected uniqueOn key.
 * @returns Promise<GetOrCreateEntityResult<T>>
 */
export const getOrCreateEntity = async <
  TableName extends keyof Database["public"]["Tables"],
>({
  supabase,
  tableName,
  insertData,
  uniqueOn = undefined,
}: {
  supabase: SupabaseClient<Database, "public", Database["public"]>;
  tableName: keyof Database["public"]["Tables"];
  insertData: TablesInsert<TableName>;
  uniqueOn?: (keyof TablesInsert<TableName>)[]; // Uses pKey otherwise
}): Promise<GetOrCreateEntityResult<Tables<TableName>>> => {
  const {
    data: entity,
    error: insertError,
    status: status,
  } = await supabase
    .from(tableName)
    .upsert(insertData, {
      onConflict: uniqueOn === undefined ? undefined : uniqueOn.join(","),
      ignoreDuplicates: false,
      count: "estimated",
    })
    .single()
    .overrideTypes<Tables<TableName>>();

  if (insertError) {
    if (insertError.code === "23505") {
      // Handle race condition: unique constraint violation (PostgreSQL error code '23505')
      const dup_key_data = unique_key_re.exec(insertError.hint);
      if (dup_key_data !== null && dup_key_data.length > 1)
        uniqueOn = dup_key_data[1]!
          .split(",")
          .map((x) => x.trim()) as (keyof TablesInsert<TableName>)[];
      if (uniqueOn && uniqueOn.length > 0) {
        console.warn(`Attempting to re-fetch using ${uniqueOn.join(", ")}`);
        let reFetchQueryBuilder = supabase.from(tableName).select();
        for (let i = 0; i < uniqueOn.length; i++) {
          const key: keyof TablesInsert<TableName> = uniqueOn[i]!;
          reFetchQueryBuilder = reFetchQueryBuilder.eq(
            key as string,
            insertData[key] as any, // TS gets confused here?
          );
        }
        const { data: reFetchedEntity, error: reFetchError } =
          await reFetchQueryBuilder.maybeSingle<Tables<TableName>>();

        if (reFetchError) {
          console.error(
            `Error re-fetching ${tableName} after unique constraint violation:`,
            reFetchError,
          );
          return {
            entity: null,
            error: `Database error after unique constraint violation for ${tableName}.`,
            details: reFetchError.message,
            created: false,
            status: 500,
          };
        }
        if (reFetchedEntity) {
          console.log(`Found ${tableName} on re-fetch:`, reFetchedEntity);
          return {
            entity: reFetchedEntity,
            error: "Upsert failed because of conflict with this entity",
            created: false,
            status: 400,
          };
        }
        return {
          entity: null,
          error: `Unique constraint violation on ${tableName} insert, and re-fetch failed to find the entity.`,
          details: insertError.message,
          created: false,
          status: 409, // Conflict, and couldn't resolve by re-fetching
        };
      }
    }

    return {
      entity: null,
      created: false,
      ...processSupabaseError(insertError, tableName),
    };
  } else if (entity) {
    console.log(`Created new ${tableName}:`, entity);
    return {
      entity,
      error: null,
      created: status == 201,
      status,
    };
  } else {
    console.error(
      `New ${tableName} was not returned after insert, despite no reported Supabase error.`,
    );
    return {
      entity: null,
      error: `Failed to retrieve new ${tableName} after insert operation.`,
      details:
        "The insert operation might have appeared successful but returned no data.",
      created: false, // Unknown if created
      status: 500,
    };
  }
};

export type BatchItemValidator<TInput, TProcessed> = (
  item: TInput,
  index: number,
) => { valid: boolean; error?: string; processedItem?: TProcessed };

export type ItemProcessor<TInput, TProcessed> = (item: TInput) => {
  valid: boolean;
  error?: string;
  processedItem?: TProcessed;
};

export type ItemValidator<T> = (item: T) => string | null;

export type BatchProcessResult<TRecord> = BaseEntityResult & {
  data?: TRecord[];
  partial_errors?: { index: number; error: string }[];
};

export const InsertValidatedBatch = async <
  TableName extends keyof Database["public"]["Tables"],
>({
  supabase,
  tableName,
  items,
  uniqueOn = undefined,
}: {
  supabase: SupabaseClient<Database, "public", Database["public"]>;
  tableName: keyof Database["public"]["Tables"];
  items: TablesInsert<TableName>[];
  uniqueOn?: (keyof TablesInsert<TableName>)[]; // Uses pKey otherwise
}): Promise<BatchProcessResult<Tables<TableName>>> => {
  const {
    data: rawData,
    error: insertError,
    status,
  } = await supabase
    .from(tableName)
    .upsert(items, {
      onConflict: uniqueOn === undefined ? undefined : uniqueOn.join(","),
      ignoreDuplicates: false,
      count: "estimated",
    })
    .select()
    .overrideTypes<Tables<TableName>>();

  const data = (rawData || []) as Tables<TableName>[]; // TS gets confused here

  if (insertError) {
    return { data, ...processSupabaseError(insertError, tableName) };
  }
  if (rawData === null) {
    console.error(`Null results while upserting ${tableName}:`, insertError);
    return {
      error: `Database error during batch insert of ${tableName}.`,
      details: "Null results",
      status: 500,
    };
  }

  if (data.length !== items.length) {
    console.warn(
      `Batch insert ${tableName}: Mismatch between processed count (${items.length}) and DB returned count (${data?.length || 0}).`,
    );
    return {
      data,
      error: `Batch insert of ${tableName} might have partially failed or returned unexpected data.`,
      status: 500, // Or a more specific error
    };
  }

  console.log(
    `Successfully batch inserted ${data.length} ${tableName} records.`,
  );
  return { data, status, error: null };
};

export const validateAndInsertBatch = async <
  TableName extends keyof Database["public"]["Tables"],
>({
  supabase,
  tableName,
  items,
  uniqueOn = undefined,
  inputValidator = undefined,
  outputValidator = undefined,
}: {
  supabase: SupabaseClient<Database, "public", Database["public"]>;
  tableName: keyof Database["public"]["Tables"];
  items: TablesInsert<TableName>[];
  uniqueOn?: (keyof TablesInsert<TableName>)[]; // Uses pKey otherwise
  inputValidator?: ItemValidator<TablesInsert<TableName>>;
  outputValidator?: ItemValidator<Tables<TableName>>;
}): Promise<BatchProcessResult<Tables<TableName>>> => {
  let validatedItems: TablesInsert<TableName>[] = [];
  const validationErrors: { index: number; error: string }[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: `Request body must be a non-empty array of ${tableName} items.`,
      status: 400,
    };
  }

  if (inputValidator !== undefined) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) {
        // Handles undefined/null items in the array itself
        validationErrors.push({
          index: i,
          error: "Item is undefined or null.",
        });
        continue;
      }
      const error = inputValidator(item);
      if (error !== null) {
        validationErrors.push({
          index: i,
          error: error || "Validation failed.",
        });
      } else {
        validatedItems.push(item);
      }
    }

    if (validationErrors.length > 0) {
      return {
        error: `Validation failed for one or more ${tableName} items.`,
        partial_errors: validationErrors,
        status: 400,
      };
    }
  } else {
    validatedItems = items;
  }
  const result = await InsertValidatedBatch<TableName>({
    supabase,
    tableName,
    items: validatedItems,
    uniqueOn,
  });
  if (result.error || !result.data) {
    return result;
  }
  if (outputValidator !== undefined) {
    const validatedResults: Tables<TableName>[] = [];
    for (let i = 0; i < result.data.length; i++) {
      const item = result.data[i];
      if (!item) {
        // Handles undefined/null items in the array itself
        validationErrors.push({
          index: i,
          error: "Returned item is undefined or null.",
        });
        continue;
      }
      const error = outputValidator(item);
      if (error !== null) {
        validationErrors.push({
          index: i,
          error: error || "Validation failed.",
        });
      } else {
        validatedResults.push(item);
      }
    }

    if (validationErrors.length > 0) {
      return {
        error: `Validation failed for one or more ${tableName} results.`,
        partial_errors: validationErrors,
        status: 500,
      };
    }
  }
  return result;
};

export const processAndInsertBatch = async <
  TableName extends keyof Database["public"]["Tables"],
  InputType,
  OutputType,
>({
  supabase,
  tableName,
  items,
  uniqueOn = undefined,
  inputProcessor,
  outputProcessor,
}: {
  supabase: SupabaseClient<Database, "public", Database["public"]>;
  tableName: keyof Database["public"]["Tables"];
  items: InputType[];
  uniqueOn?: (keyof TablesInsert<TableName>)[]; // Uses pKey otherwise
  inputProcessor: ItemProcessor<InputType, TablesInsert<TableName>>;
  outputProcessor: ItemProcessor<Tables<TableName>, OutputType>;
}): Promise<BatchProcessResult<OutputType>> => {
  let processedItems: TablesInsert<TableName>[] = [];
  const validationErrors: { index: number; error: string }[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: `Request body must be a non-empty array of ${tableName} items.`,
      status: 400,
    };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      // Handles undefined/null items in the array itself
      validationErrors.push({
        index: i,
        error: "Item is undefined or null.",
      });
      continue;
    }
    const { valid, error, processedItem } = inputProcessor(item);
    if (!valid || !processedItem) {
      validationErrors.push({
        index: i,
        error: error || "Validation failed.",
      });
    } else {
      processedItems.push(processedItem);
    }
  }

  if (validationErrors.length > 0) {
    return {
      error: `Validation failed for one or more ${tableName} items.`,
      partial_errors: validationErrors,
      status: 400,
    };
  }
  const result = await InsertValidatedBatch<TableName>({
    supabase,
    tableName,
    items: processedItems,
    uniqueOn,
  });
  if (result.error || !result.data) {
    return { ...result, data: [] };
  }
  const processedResults: OutputType[] = [];
  for (let i = 0; i < result.data.length; i++) {
    const item = result.data[i];
    if (!item) {
      // Handles undefined/null items in the array itself
      validationErrors.push({
        index: i,
        error: "Returned item is undefined or null.",
      });
      continue;
    }
    const { valid, error, processedItem } = outputProcessor(item);
    if (!valid || !processedItem) {
      validationErrors.push({
        index: i,
        error: error || "Result validation failed.",
      });
    } else {
      processedResults.push(processedItem);
    }
  }

  if (validationErrors.length > 0) {
    return {
      error: `Validation failed for one or more ${tableName} results.`,
      partial_errors: validationErrors,
      status: 500,
    };
  }
  return { ...result, data: processedResults };
};
