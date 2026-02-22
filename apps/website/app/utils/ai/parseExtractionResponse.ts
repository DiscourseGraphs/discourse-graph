import { ExtractionResult, ExtractionResultSchema } from "~/types/extraction";

export const parseExtractionResponse = (raw: string): ExtractionResult => {
  let cleaned = raw.trim();

  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }

  const firstBraceIndex = cleaned.indexOf("{");
  const lastBraceIndex = cleaned.lastIndexOf("}");
  if (
    firstBraceIndex !== -1 &&
    lastBraceIndex !== -1 &&
    lastBraceIndex > firstBraceIndex
  ) {
    cleaned = cleaned.slice(firstBraceIndex, lastBraceIndex + 1);
  }

  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  const parsed: unknown = JSON.parse(cleaned);
  return ExtractionResultSchema.parse(parsed);
};
