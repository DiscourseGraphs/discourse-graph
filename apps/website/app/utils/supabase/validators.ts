import {
  known_embedding_tables,
  ItemProcessor,
  ItemValidator,
} from "./dbUtils";
import { Tables, TablesInsert } from "./types.gen";

// Use the first known ContentEmbedding table for type checking, as they have the same structure
export type ContentEmbeddingDataInput =
  TablesInsert<"ContentEmbedding_openai_text_embedding_3_small_1536">;
export type ContentEmbeddingRecord =
  Tables<"ContentEmbedding_openai_text_embedding_3_small_1536">;

export type ApiInputEmbeddingItem = Omit<
  ContentEmbeddingDataInput,
  "vector"
> & {
  vector: number[];
};

export type ApiOutputEmbeddingRecord = Omit<
  ContentEmbeddingRecord,
  "vector"
> & {
  vector: number[];
};

export const embeddingInputValidation: ItemValidator<ApiInputEmbeddingItem> = (
  data,
) => {
  if (!data || typeof data !== "object")
    return "Invalid request body: expected a JSON object.";
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
    known_embedding_tables[model] == undefined
  ) {
    return "Missing or invalid model name.";
  }
  const { table_size } = known_embedding_tables[model];

  if (
    !vector ||
    !Array.isArray(vector) ||
    !vector.every((v) => typeof v === "number")
  ) {
    return "Missing or invalid vector. Must be an array of numbers.";
  }
  if (vector.length != table_size) {
    return `Invalid vector length. Expected ${table_size}, got ${vector.length}.`;
  }
  if (data.obsolete !== undefined && typeof data.obsolete !== "boolean") {
    return "Invalid type for obsolete. Must be a boolean.";
  }
  return null;
};

export const embeddingInputProcessing: ItemProcessor<
  ApiInputEmbeddingItem,
  ContentEmbeddingDataInput
> = (data) => {
  const error = embeddingInputValidation(data);
  if (error) {
    return { valid: false, error };
  }
  return {
    valid: true,
    data: { ...data, vector: JSON.stringify(data.vector) },
  };
};

export const embeddingOutputValidation: ItemValidator<
  ApiOutputEmbeddingRecord
> = (data) => {
  const { model, vector } = data;
  if (
    !model ||
    typeof model !== "string" ||
    known_embedding_tables[model] == undefined
  ) {
    return "Missing or invalid model name.";
  }

  const { table_size } = known_embedding_tables[model];

  if (vector.length != table_size) {
    return `Invalid vector length. Expected ${table_size}, got ${vector.length}.`;
  }
  return null;
};

export const embeddingOutputProcessing: ItemProcessor<
  ContentEmbeddingRecord,
  ApiOutputEmbeddingRecord
> = (data) => {
  try {
    const processedData = { ...data, vector: JSON.parse(data.vector) };
    const error = embeddingOutputValidation(processedData);
    if (error) {
      return { valid: false, error };
    }
    return {
      valid: true,
      data: processedData,
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

export const contentInputValidation: ItemValidator<ContentDataInput> = (
  data: ContentDataInput,
) => {
  if (!data || typeof data !== "object")
    return "Invalid request body: expected a JSON object.";
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
