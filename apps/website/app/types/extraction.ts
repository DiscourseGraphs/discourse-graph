import { z } from "zod";

export const PROVIDER_IDS = ["anthropic", "openai", "gemini"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ExtractedNodeSchema = z.object({
  nodeType: z.string(),
  content: z.string(),
  supportSnippet: z.string(),
  sourceSection: z.string().nullable(),
});

export type ExtractedNode = z.infer<typeof ExtractedNodeSchema>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ExtractionResultSchema = z.object({
  nodes: z.array(ExtractedNodeSchema),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ExtractionRequestSchema = z.object({
  pdfBase64: z.string().min(1).max(44_000_000),
  provider: z.enum(PROVIDER_IDS),
  model: z.string().min(1),
  researchQuestion: z.string().optional(),
  systemPrompt: z.string().optional(),
});

export type ExtractionRequest = z.infer<typeof ExtractionRequestSchema>;

export const EXTRACTION_RESULT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    nodes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nodeType: { type: "string" },
          content: { type: "string" },
          supportSnippet: { type: "string" },
          sourceSection: { type: ["string", "null"] },
        },
        required: ["nodeType", "content", "supportSnippet", "sourceSection"],
        additionalProperties: false,
      },
    },
  },
  required: ["nodes"],
  additionalProperties: false,
};

export type ExtractionResponse =
  | { success: true; data: ExtractionResult }
  | { success: false; error: string };
