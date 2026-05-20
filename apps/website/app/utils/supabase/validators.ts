import type { PublicTableName, RawTablesInsert, RawTables } from "./dbUtils";
import type { Tables, TablesInsert } from "@repo/database/dbTypes";

/* eslint-disable @typescript-eslint/naming-convention */
export type InputTypes = {
  ContentEmbedding_openai_text_embedding_3_small_1536: ContentEmbeddingVecTablesInsert;
};
export type OutputTypes = {
  ContentEmbedding_openai_text_embedding_3_small_1536: ContentEmbeddingVecTables;
};
/* eslint-enable @typescript-eslint/naming-convention */

export type InputTypeOf<T extends PublicTableName> = T extends keyof InputTypes
  ? InputTypes[T]
  : RawTablesInsert<T>;
export type OutputTypeOf<T extends PublicTableName> =
  T extends keyof OutputTypes ? OutputTypes[T] : RawTables<T>;

export type ItemProcessor<T extends PublicTableName> = (
  item: InputTypeOf<T>,
) => {
  valid: boolean;
  error?: string;
  processedItem?: RawTablesInsert<T>;
};

export type ItemOutputProcessor<T extends PublicTableName> = (
  item: RawTables<T>,
) => {
  valid: boolean;
  error?: string;
  processedItem?: OutputTypeOf<T>;
};

export type ItemValidator<T extends PublicTableName> = (
  item: RawTables<T> | RawTablesInsert<T>,
) => string | null;

// Those next three types would be unions if we ever have more embedding tables
export type ContentEmbeddingTableName =
  "ContentEmbedding_openai_text_embedding_3_small_1536";
export type ContentEmbeddingStrTablesInsert =
  RawTablesInsert<"ContentEmbedding_openai_text_embedding_3_small_1536">;
export type ContentEmbeddingStrTables =
  RawTables<"ContentEmbedding_openai_text_embedding_3_small_1536">;

export const KNOWN_EMBEDDING_TABLES: {
  [key: string]: {
    tableName: ContentEmbeddingTableName;
    tableSize: number;
  };
} = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  openai_text_embedding_3_small_1536: {
    tableName: "ContentEmbedding_openai_text_embedding_3_small_1536",
    tableSize: 1536,
  },
};

export type ContentEmbeddingVecTablesInsert = Omit<
  ContentEmbeddingStrTablesInsert,
  "vector"
> & {
  vector: number[];
};

export type ContentEmbeddingVecTables = Omit<
  ContentEmbeddingStrTables,
  "vector"
> & {
  vector: number[];
};

// type: ItemValidator<T>
export const embeddingInputValidation = <T extends ContentEmbeddingTableName>(
  data: InputTypeOf<T>,
): string | null => {
  if (!data || typeof data !== "object")
    return "Invalid request body: expected a JSON object.";
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { target_id, model, vector } = data;

  if (
    target_id === undefined ||
    target_id === null ||
    typeof target_id !== "number"
  ) {
    return "Missing or invalid target_id.";
  }
  if (
    !model ||
    typeof model !== "string" ||
    KNOWN_EMBEDDING_TABLES[model] == undefined
  ) {
    return "Missing or invalid model name.";
  }
  const { tableSize } = KNOWN_EMBEDDING_TABLES[model];

  if (
    !vector ||
    !Array.isArray(vector) ||
    !vector.every((v) => typeof v === "number")
  ) {
    return "Missing or invalid vector. Must be an array of numbers.";
  }
  if (vector.length !== tableSize) {
    return `Invalid vector length. Expected ${tableSize}, got ${vector.length}.`;
  }
  if (data.obsolete !== undefined && typeof data.obsolete !== "boolean") {
    return "Invalid type for obsolete. Must be a boolean.";
  }
  return null;
};

// type: ItemProcessor<T>
export const embeddingInputProcessing = <T extends ContentEmbeddingTableName>(
  data: InputTypeOf<T>,
): {
  valid: boolean;
  error?: string;
  processedItem?: RawTablesInsert<T>;
} => {
  const error = embeddingInputValidation(data);
  if (error) {
    return { valid: false, error };
  }
  return {
    valid: true,
    processedItem: {
      ...data,
      vector: JSON.stringify(data.vector),
    } as RawTablesInsert<T>,
  };
};

// type: ItemOutputValidator<T>
export const embeddingOutputValidation = <T extends ContentEmbeddingTableName>(
  data: OutputTypeOf<T>,
): string | null => {
  const { model, vector } = data;
  if (
    !model ||
    typeof model !== "string" ||
    KNOWN_EMBEDDING_TABLES[model] == undefined
  ) {
    return "Missing or invalid model name.";
  }

  const { tableSize } = KNOWN_EMBEDDING_TABLES[model];

  if (vector.length !== tableSize) {
    return `Invalid vector length. Expected ${tableSize}, got ${vector.length}.`;
  }
  return null;
};

// type: ItemOutputProcessor<T>
export const embeddingOutputProcessing = <T extends ContentEmbeddingTableName>(
  data: Tables<T>,
): {
  valid: boolean;
  error?: string;
  processedItem?: OutputTypeOf<T>;
} => {
  try {
    const processedData = {
      ...data,
      vector: JSON.parse(data.vector) as number[],
    } as OutputTypeOf<T>;
    const error = embeddingOutputValidation(processedData);
    if (error) {
      return { valid: false, error };
    }
    return {
      valid: true,
      processedItem: processedData,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { valid: false, error: error.message };
    }
    throw error;
  }
};

export type ContentDataInput = TablesInsert<"Content">;
export type ContentRecord = Tables<"Content">;

// type: ItemValidator<"Content">
export const contentInputValidation = (
  data: ContentDataInput,
): string | null => {
  if (!data || typeof data !== "object")
    return "Invalid request body: expected a JSON object.";
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { author_id, created, last_modified, scale, space_id, text } = data;

  if (!text || typeof text !== "string") return "Invalid or missing text.";
  if (!scale || typeof scale !== "string") return "Invalid or missing scale.";
  if (
    space_id === undefined ||
    space_id === null ||
    typeof space_id !== "number"
  )
    return "Invalid or missing space_id.";
  if (
    author_id === undefined ||
    author_id === null ||
    typeof author_id !== "number"
  )
    return "Invalid or missing author_id.";
  if (created)
    try {
      new Date(created);
    } catch (e) {
      return "Invalid date format for created.";
    }
  if (last_modified)
    try {
      new Date(last_modified);
    } catch (e) {
      return "Invalid date format for last_modified.";
    }
  return null;
};
