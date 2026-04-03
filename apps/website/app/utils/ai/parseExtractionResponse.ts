import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "~/types/extraction";

export const parseExtractionResponse = (raw: string): ExtractionResult => {
  const parsed: unknown = JSON.parse(raw);
  return ExtractionResultSchema.parse(parsed);
};
