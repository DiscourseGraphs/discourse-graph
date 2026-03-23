import { z } from "zod";

/* eslint-disable @typescript-eslint/naming-convention */

export const NODE_TYPES = [
  "CLM",
  "QUE",
  "EVD",
  "SRC",
  "ISS",
  "RES",
  "HYP",
  "CON",
  "EXP",
  "THR",
  "ART",
  "MTD",
  "PAT",
  "PRJ",
  "PRB",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  CLM: "Claim",
  QUE: "Question",
  EVD: "Evidence",
  SRC: "Source",
  ISS: "Issue",
  RES: "Result",
  HYP: "Hypothesis",
  CON: "Conclusion",
  EXP: "Experiment",
  THR: "Theory",
  ART: "Artifact",
  MTD: "Method",
  PAT: "Pattern",
  PRJ: "Project",
  PRB: "Problem",
};

export const PROVIDER_IDS = ["anthropic", "openai", "gemini"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const CandidateNodeSchema = z.object({
  nodeType: z.enum(NODE_TYPES),
  content: z.string(),
  supportSnippet: z.string(),
  sourceSection: z.string().optional(),
  pageNumber: z.number().optional(),
});

export type CandidateNode = z.infer<typeof CandidateNodeSchema>;

export const ExtractionResultSchema = z.object({
  paperTitle: z.string(),
  paperAuthors: z.array(z.string()),
  candidates: z.array(CandidateNodeSchema),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const ExtractionRequestSchema = z.object({
  pdfBase64: z.string().min(1),
  researchQuestion: z.string().optional(),
  nodeTypes: z.array(z.enum(NODE_TYPES)).min(1),
  model: z.string().min(1),
  provider: z.enum(PROVIDER_IDS),
  systemPrompt: z.string().min(1),
});

export type ExtractionRequest = z.infer<typeof ExtractionRequestSchema>;

export type ExtractionResponse =
  | { success: true; data: ExtractionResult }
  | { success: false; error: string };
