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
  systemPrompt: z.string().min(1),
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

export type NodeTypeDefinition = {
  label: string;
  definition: string;
  candidateTag: string;
  color?: string;
};

type ModelOption = {
  id: string;
  label: string;
};

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";

export const NODE_TYPE_DEFINITIONS: NodeTypeDefinition[] = [
  {
    label: "Evidence",
    definition:
      "A specific empirical observation from a particular study. One distinct statistical test, measurement, or analytical finding. Past tense. Includes observable, model system, method.",
    candidateTag: "#evd-candidate",
    color: "#DB134A",
  },
  {
    label: "Claim",
    definition:
      "An atomic, generalized assertion about the world that proposes to answer a research question. Goes beyond data to state what it means. Specific enough to test or argue against.",
    candidateTag: "#clm-candidate",
    color: "#7DA13E",
  },
  {
    label: "Question",
    definition:
      "A research question — explicitly stated or implied by a gap in the literature. Open-ended, answerable by empirical evidence.",
    candidateTag: "#que-candidate",
    color: "#99890E",
  },
  {
    label: "Pattern",
    definition:
      "A conceptual class — a theoretical object, heuristic, design pattern, or methodological approach — abstracted from specific implementations.",
    candidateTag: "#ptn-candidate",
    color: "#E040FB",
  },
  {
    label: "Artifact",
    definition:
      "A specific concrete system, tool, standard, dataset, or protocol that instantiates one or more patterns.",
    candidateTag: "#art-candidate",
    color: "#67C23A",
  },
];
