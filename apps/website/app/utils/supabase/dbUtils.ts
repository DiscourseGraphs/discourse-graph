import type {
  SupabaseClient,
  PostgrestResponse,
  PostgrestSingleResponse,
} from "@supabase/supabase-js";
import { PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@repo/database/dbTypes";

type PublicTableName = keyof Database["public"]["Tables"];
type PublicTableRow<TableName extends PublicTableName> =
  Database["public"]["Tables"][TableName]["Row"];
type PublicTableInsert<TableName extends PublicTableName> =
  Database["public"]["Tables"][TableName] extends { Insert: unknown }
    ? Database["public"]["Tables"][TableName]["Insert"]
    : never;
type PublicTableInsertKey<TableName extends PublicTableName> =
  keyof PublicTableInsert<TableName> & string;
type KnownEmbeddingTable = {
  tableName: "ContentEmbedding_openai_text_embedding_3_small_1536";
  tableSize: number;
};

export const KNOWN_EMBEDDING_TABLES: {
  [key: string]: KnownEmbeddingTable | undefined;
} = {
  openai_text_embedding_3_small_1536: {
    tableName: "ContentEmbedding_openai_text_embedding_3_small_1536",
    tableSize: 1536,
  },
};

const UNIQUE_KEY_RE = /^Key \(([^)]+)\)=\(([\^)]+)\) already exists\.$/;
const UNIQUE_INDEX_RE =
  /duplicate key value violates unique constraint "(\w+)"/;
const FOREIGN_KEY_RE =
  /Keys? \(([^)]+)\)=\(([^)]+)\) (is|are) not present in table ("?\w+"?)./;
const FOREIGN_CONSTRAINT_RE =
  /insert or update on table ("?\w+"?) violates foreign key constraint ("?\w+"?)/;

const processSupabaseError = <T>(
  response: PostgrestResponse<T>,
  tableName: string,
): PostgrestResponse<T> => {
  const { error } = response;
  if (error == null) return response; // should not happen, but makes TS happy
  console.error(`Error inserting new ${tableName}:`, error);
  if (error.code === "23505") {
    // Handle race condition: unique constraint violation (PostgreSQL error code '23505')
    console.warn(
      `Unique constraint violation on ${tableName} insert .\nError is ${error.message}, ${error.hint}.`,
    );
    const dup_key_data = UNIQUE_KEY_RE.exec(error.hint);
    if (dup_key_data !== null && dup_key_data.length > 1) {
      const uniqueOn = dup_key_data[1]!.split(",").map((x) => x.trim());
      if (uniqueOn.length === 0) {
        const idx_data = UNIQUE_INDEX_RE.exec(error.message);
        response.error.message =
          idx_data === null
            ? "Could not identify the keys or index of the unique constraint"
            : `Could not identify the keys of the unique key index ${idx_data[1]}`;
        response.status = 400;
        return response;
      }
    }
    response.error.message = `Unique constraint violation on ${tableName} insert, and re-fetch failed to find the entity.`;
    response.status = 409; // Conflict, and couldn't resolve by re-fetching
  } else if (error.code === "23503") {
    // Handle foreign key constraint violations (PostgreSQL error code '23503')
    const fkey_data = FOREIGN_KEY_RE.exec(error.hint);
    const constraint_data = FOREIGN_CONSTRAINT_RE.exec(error.message);
    console.warn(
      `Foreign violation on ${tableName}, constraint ${constraint_data ? constraint_data[2] : "unknown"}, keys ${fkey_data ? fkey_data[1] : "unknown"}`,
    );
    response.error.message =
      fkey_data === null
        ? constraint_data === null
          ? "Could not identify the missing foreign key"
          : `Foreign key constraint ${constraint_data[2]} violated`
        : `Foreign key ${fkey_data[1]} is missing value ${fkey_data[2]}`;
    response.status = 400;
  }
  return response;
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
export const getOrCreateEntity = async <TableName extends PublicTableName>({
  supabase,
  tableName,
  insertData,
  uniqueOn = undefined,
}: {
  supabase: SupabaseClient<Database, "public">;
  tableName: TableName;
  insertData: PublicTableInsert<TableName>;
  uniqueOn?: PublicTableInsertKey<TableName>[]; // Uses pKey otherwise
}): Promise<PostgrestSingleResponse<PublicTableRow<TableName>>> => {
  const result: PostgrestSingleResponse<PublicTableRow<TableName>> =
    await supabase
      .from(tableName)
      .upsert(insertData, {
        onConflict: uniqueOn === undefined ? undefined : uniqueOn.join(","),
        ignoreDuplicates: false,
        count: "estimated",
      })
      .select()
      .single();
  if (result.error) {
    const { error: insertError } = result;
    if (insertError.code === "23505") {
      // Handle race condition: unique constraint violation (PostgreSQL error code '23505')
      const dup_key_data = UNIQUE_KEY_RE.exec(insertError.hint);
      const reFetchKeys =
        dup_key_data !== null && dup_key_data.length > 1
          ? dup_key_data[1]!.split(",").map((x) => x.trim())
          : uniqueOn?.map((x) => x);
      if (reFetchKeys && reFetchKeys.length > 0) {
        console.warn(`Attempting to re-fetch using ${reFetchKeys.join(", ")}`);
        let reFetchQueryBuilder = supabase.from(tableName).select();
        for (let i = 0; i < reFetchKeys.length; i++) {
          const key = reFetchKeys[i];
          if (!key) {
            console.error("Empty key in uniqueOn");
            continue;
          }
          const insertEntry = Object.entries(insertData).find(
            ([insertKey]) => insertKey === key,
          );
          if (!insertEntry) {
            console.error(`Missing insert data for unique key ${key}`);
            continue;
          }
          reFetchQueryBuilder = reFetchQueryBuilder.filter(
            key,
            "eq",
            insertEntry[1],
          );
        }
        const reFetchResult =
          await reFetchQueryBuilder.maybeSingle<PublicTableRow<TableName>>();
        const { data: reFetchedEntity, error: reFetchError } = reFetchResult;

        if (reFetchResult === null) {
          result.error.message = `Unique constraint violation on on (${reFetchKeys.join(", ")}) in ${tableName}, and re-fetch failed to find the entity because of ${reFetchError}.`;
          result.status = 500;
          return result;
        } else {
          console.log(`Found ${tableName} on re-fetch:`, reFetchedEntity);
          // Note: Using a PostgrestResult means I cannot have both data and error non-null...
          return {
            error: new PostgrestError({
              ...result.error,
              message: `Upsert failed because of conflict with this entity: ${reFetchedEntity}"`,
            }),
            statusText: result.statusText,
            data: null,
            count: null,
            status: 400,
            success: false,
          };
        }
      }
    }
    processSupabaseError(result, tableName);
  }
  return result;
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

export const InsertValidatedBatch = async <TableName extends PublicTableName>({
  supabase,
  tableName,
  items,
  uniqueOn = undefined,
}: {
  supabase: SupabaseClient<Database, "public">;
  tableName: TableName;
  items: PublicTableInsert<TableName>[];
  uniqueOn?: PublicTableInsertKey<TableName>[]; // Uses pKey otherwise
}): Promise<PostgrestResponse<PublicTableRow<TableName>>> => {
  const result: PostgrestResponse<PublicTableRow<TableName>> = await supabase
    .from(tableName)
    .upsert(items, {
      onConflict: uniqueOn === undefined ? undefined : uniqueOn.join(","),
      ignoreDuplicates: false,
      count: "estimated",
    })
    .select();
  const { data, error, status } = result;

  if (error !== null) {
    processSupabaseError(result, tableName);
    return result;
  }

  if (data.length !== items.length) {
    console.warn(
      `Batch insert ${tableName}: Mismatch between processed count (${items.length}) and DB returned count (${data?.length || 0}).`,
    );
    result.statusText = `Batch insert of ${tableName} might have partially failed or returned unexpected data.`;
    result.status = 500;
  }

  console.log(
    `Successfully batch inserted ${data.length} ${tableName} records.`,
  );
  return result;
};

export const validateAndInsertBatch = async <
  TableName extends PublicTableName,
>({
  supabase,
  tableName,
  items,
  uniqueOn = undefined,
  inputValidator = undefined,
  outputValidator = undefined,
}: {
  supabase: SupabaseClient<Database, "public">;
  tableName: TableName;
  items: PublicTableInsert<TableName>[];
  uniqueOn?: PublicTableInsertKey<TableName>[]; // Uses pKey otherwise
  inputValidator?: ItemValidator<PublicTableInsert<TableName>>;
  outputValidator?: ItemValidator<PublicTableRow<TableName>>;
}): Promise<PostgrestResponse<PublicTableRow<TableName>>> => {
  let validatedItems: PublicTableInsert<TableName>[] = [];
  const validationErrors: { index: number; error: string }[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: new PostgrestError({
        message: `Request body must be a non-empty array of ${tableName} items.`,
        details: "",
        hint: "nonempty",
        code: "1",
      }),
      status: 400,
      success: false,
      data: null,
      count: null,
      statusText: "Empty input",
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
        error: new PostgrestError({
          message: `Validation failed for one or more ${tableName} items.`,
          details: `${validationErrors}`,
          hint: "invalid",
          code: "2",
        }),
        success: false,
        status: 400,
        data: null,
        count: null,
        statusText: "Validation errors",
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
  if (result.error) {
    return result;
  }
  if (outputValidator !== undefined) {
    const validatedResults: PublicTableRow<TableName>[] = [];
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
          error: error || `Validation failed for ${item}.`,
        });
      } else {
        validatedResults.push(item);
      }
    }

    if (validationErrors.length > 0) {
      if (validatedResults.length > 0) {
        // Erring on the side of returning data with an error in status.
        return {
          error: null,
          success: true,
          status: 500,
          data: validatedResults,
          count: validatedResults.length,
          statusText: `Validation failed for one or more ${tableName} items, and succeeded for ${validatedResults.length}/${result.data.length}.`,
        };
      } else {
        return {
          error: new PostgrestError({
            message: `Post-validation failed for all ${tableName} items.`,
            details: `${validationErrors}`,
            hint: "invalid",
            code: "2",
          }),
          success: false,
          status: 500,
          data: null,
          count: null,
          statusText: "post-validation",
        };
      }
    }
  }
  return result;
};

export const processAndInsertBatch = async <
  TableName extends PublicTableName,
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
  supabase: SupabaseClient<Database, "public">;
  tableName: TableName;
  items: InputType[];
  uniqueOn?: PublicTableInsertKey<TableName>[]; // Uses pKey otherwise
  inputProcessor: ItemProcessor<InputType, PublicTableInsert<TableName>>;
  outputProcessor: ItemProcessor<PublicTableRow<TableName>, OutputType>;
}): Promise<PostgrestResponse<OutputType>> => {
  const processedItems: PublicTableInsert<TableName>[] = [];
  const validationErrors: { index: number; error: string }[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return {
      error: new PostgrestError({
        message: `Request body must be a non-empty array of ${tableName} items.`,
        details: "",
        hint: "nonempty",
        code: "1",
      }),
      success: false,
      status: 400,
      data: null,
      count: null,
      statusText: "Empty input",
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
      error: new PostgrestError({
        message: `Validation failed for one or more ${tableName} items.`,
        details: `${validationErrors}`,
        hint: "invalid",
        code: "2",
      }),
      success: false,
      status: 400,
      data: null,
      count: null,
      statusText: "Validation errors",
    };
  }
  const result = await InsertValidatedBatch<TableName>({
    supabase,
    tableName,
    items: processedItems,
    uniqueOn,
  });
  if (result.error) {
    return result;
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
    if (processedResults.length > 0) {
      // Erring on the side of returning data with an error in status.
      return {
        error: null,
        status: 500,
        success: true,
        data: processedResults,
        count: processedResults.length,
        statusText: `Validation failed for one or more ${tableName} items, and succeeded for ${processedResults.length}/${result.data.length}.`,
      };
    } else {
      return {
        error: new PostgrestError({
          message: `Post-validation failed for all ${tableName} items.`,
          details: `${validationErrors}`,
          hint: "invalid",
          code: "2",
        }),
        success: false,
        status: 500,
        data: null,
        count: null,
        statusText: "post-validation",
      };
    }
  }
  return { ...result, data: processedResults };
};
