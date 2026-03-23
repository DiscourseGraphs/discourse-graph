import {
  ExtractionResultSchema,
  type ExtractionResult,
} from "~/types/extraction";

export const parseExtractionResponse = (raw: string): ExtractionResult => {
  let cleaned = raw.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  const parsed: unknown = JSON.parse(cleaned);
  return ExtractionResultSchema.parse(parsed);
};
