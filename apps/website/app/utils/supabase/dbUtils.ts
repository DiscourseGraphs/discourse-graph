import type { SupabaseClient } from "@supabase/supabase-js";
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

export type GetOrCreateEntityResult<T> = {
  entity: T | null;
  error: string | null;
  details?: string; // For detailed error messages, e.g., from Supabase
  created: boolean;
  status: number; // HTTP status code to suggest
};

/**
 * Generic function to get an entity or create it if it doesn't exist.
 * Handles common race conditions for unique constraint violations.
 *
 * @param supabase Supabase client instance.
 * @param tableName The name of the table.
 * @param selectQuery The select string, e.g., "id, name, url".
 * @param matchCriteria An object representing the WHERE clause for lookup, e.g., { url: "some-url" }.
 * @param insertData Data to insert if the entity is not found.
 * @param entityName A friendly name for the entity, used in logging and error messages.
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
    data: newEntity,
    error: insertError,
    status: status,
  } = await supabase
    .from(tableName)
    .upsert(insertData, {
      onConflict: uniqueOn === undefined ? undefined : uniqueOn.join(","),
      ignoreDuplicates: false,
      count: "estimated",
    })
    .select();

  if (insertError) {
    console.error(`Error inserting new ${tableName}:`, insertData, insertError);
    // Handle race condition: unique constraint violation (PostgreSQL error code '23505')
    if (insertError.code === "23505") {
      // It could well be another unique constraint
      // TODO: Can I identify the unique key constraint to do a fetch?
      console.warn(
        `Unique constraint violation on ${tableName} insert using ${uniqueOn}.\nError is ${insertError.message}.\n Attempting to re-fetch.`,
      );
      let reFetchQueryBuilder = supabase.from(tableName).select();
      if (uniqueOn !== undefined) {
        for (let i = 0; i < uniqueOn.length; i++) {
          const key: keyof TablesInsert<TableName> = uniqueOn[i]!;
          reFetchQueryBuilder = reFetchQueryBuilder.eq(
            key as string,
            insertData[key] as any, // TS gets confused here?
          );
        }
      } else if (false) {
        // TODO: Another case is when we were given the primary key.
        // But we have to compute the primary key for that. Punting.
      } else {
        // Likely another unique constraint
        // TODO: have to decode from insertError message
        return {
          entity: null,
          error: "Could not decide what to refetch on",
          details: insertError.message,
          created: false,
          status: 400,
        };
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
          error: null,
          created: false,
          status: 200, // Successfully fetched, though not created by this call.
        };
      }
      return {
        entity: null,
        error: `Unique constraint violation on ${tableName} insert, and re-fetch failed to find the entity.`,
        details: insertError.message, // Original insert error
        created: false,
        status: 409, // Conflict, and couldn't resolve by re-fetching
      };
    }

    // Handle foreign key constraint violations (PostgreSQL error code '23503')
    if (insertError.code === "23503") {
      return {
        entity: null,
        error: `Invalid reference: A foreign key constraint was violated while creating ${tableName}.`,
        details: insertError.message, // Specific FK details are in the message
        created: false,
        status: 400, // Usually due to bad input ID
      };
    }

    return {
      entity: null,
      error: `Database error while inserting ${tableName}.`,
      details: insertError.message,
      created: false,
      status: 500,
    };
  } else if (newEntity) {
    const entityT = newEntity as Tables<TableName> | Tables<TableName>[] | null;
    let entity: Tables<TableName> | null = null;
    if (Array.isArray(entityT)) {
      if (entityT.length > 0) entity = entityT[0]!;
      else
        return {
          entity: null,
          error: `Got an empty array from the upsert`,
          created: false,
          status: 500,
        };
    } else {
      entity = entityT;
    }
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

export type BatchProcessResult<TRecord> = {
  data?: TRecord[];
  error?: string;
  details?: string; // For DB error details
  partial_errors?: { index: number; error: string }[];
  status: number; // HTTP status to suggest
};

export const InsertValidatedBatch = async <
  TableName extends keyof Database["public"]["Tables"],
>(
  supabase: SupabaseClient<Database, "public", Database["public"]>,
  items: TablesInsert<TableName>[],
  tableName: keyof Database["public"]["Tables"],
  selectQuery: string, // e.g., "id, field1, field2" or "*"
  entityName: string = tableName, // For logging
): Promise<BatchProcessResult<Tables<TableName>>> => {
  const { data: newRecords, error: insertError } = await supabase
    .from(tableName)
    .insert(items)
    .select(selectQuery); // Use the provided select query

  if (insertError) {
    console.error(`Error batch inserting ${entityName}:`, insertError);
    return {
      error: `Database error during batch insert of ${entityName}.`,
      details: insertError.message,
      status: 500,
    };
  }

  const newRecordsTyped = newRecords as Tables<TableName>[];

  if (!newRecordsTyped || newRecordsTyped.length !== items.length) {
    console.warn(
      `Batch insert ${entityName}: Mismatch between processed count (${items.length}) and DB returned count (${newRecordsTyped?.length || 0}).`,
    );
    return {
      error: `Batch insert of ${entityName} might have partially failed or returned unexpected data.`,
      status: 500, // Or a more specific error
    };
  }

  console.log(
    `Successfully batch inserted ${newRecordsTyped.length} ${entityName} records.`,
  );
  return { data: newRecordsTyped, status: 201 };
};

export const validateAndInsertBatch = async <
  TableName extends keyof Database["public"]["Tables"],
>(
  supabase: SupabaseClient<Database, "public", Database["public"]>,
  items: TablesInsert<TableName>[],
  tableName: keyof Database["public"]["Tables"],
  selectQuery: string, // e.g., "id, field1, field2" or "*"
  entityName: string = tableName, // For logging
  inputValidator: ItemValidator<TablesInsert<TableName>> | null,
  outputValidator: ItemValidator<Tables<TableName>> | null,
): Promise<BatchProcessResult<Tables<TableName>>> => {
  let validatedItems: TablesInsert<TableName>[] = [];
  const validationErrors: { index: number; error: string }[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: `Request body must be a non-empty array of ${entityName} items.`,
      status: 400,
    };
  }

  if (inputValidator !== null) {
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
        error: `Validation failed for one or more ${entityName} items.`,
        partial_errors: validationErrors,
        status: 400,
      };
    }
  } else {
    validatedItems = items;
  }
  const result = await InsertValidatedBatch<TableName>(
    supabase,
    validatedItems,
    tableName,
    selectQuery,
    entityName,
  );
  if (result.error || !result.data) {
    return result;
  }
  if (outputValidator !== null) {
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
        error: `Validation failed for one or more ${entityName} results.`,
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
>(
  supabase: SupabaseClient<Database, "public", Database["public"]>,
  items: InputType[],
  tableName: keyof Database["public"]["Tables"],
  selectQuery: string, // e.g., "id, field1, field2" or "*"
  entityName: string = tableName, // For logging
  inputProcessor: ItemProcessor<InputType, TablesInsert<TableName>>,
  outputProcessor: ItemProcessor<Tables<TableName>, OutputType>,
): Promise<BatchProcessResult<OutputType>> => {
  let processedItems: TablesInsert<TableName>[] = [];
  const validationErrors: { index: number; error: string }[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: `Request body must be a non-empty array of ${entityName} items.`,
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
      error: `Validation failed for one or more ${entityName} items.`,
      partial_errors: validationErrors,
      status: 400,
    };
  }
  const result = await InsertValidatedBatch<TableName>(
    supabase,
    processedItems,
    tableName,
    selectQuery,
    entityName,
  );
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
      error: `Validation failed for one or more ${entityName} results.`,
      partial_errors: validationErrors,
      status: 500,
    };
  }
  return { ...result, data: processedResults };
};
