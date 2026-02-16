import { z } from "zod";

export const NODE_TYPES = [
  "CLM", "QUE", "EVD", "SRC",
  "ISS", "RES", "EXP", "THR",
  "ART", "MTD", "PAT", "HYP", "CON",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

/* eslint-disable @typescript-eslint/naming-convention */
export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  CLM: "Claim",
  QUE: "Question",
  EVD: "Evidence",
  SRC: "Source",
  ISS: "Issue",
  RES: "Result",
  EXP: "Experiment",
  THR: "Theory",
  ART: "Artifact",
  MTD: "Method",
  PAT: "Pattern",
  HYP: "Hypothesis",
  CON: "Conclusion",
};

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  CLM: "#7DA13E",
  QUE: "#99890E",
  EVD: "#DB134A",
  SRC: "#9E9E9E",
  ISS: "#F56C6C",
  RES: "#E6A23C",
  EXP: "#4A90D9",
  THR: "#8B5CF6",
  ART: "#67C23A",
  MTD: "#409EFF",
  PAT: "#E040FB",
  HYP: "#7C4DFF",
  CON: "#26A69A",
};

export const NODE_FORMAT_MAP: Record<NodeType, string> = {
  CLM: "[[CLM]] - {content}",
  QUE: "[[QUE]] - {content}",
  EVD: "[[EVD]] - {content} - {Source}",
  SRC: "@{content}",
  ISS: "[[ISS]] - {content}",
  RES: "[[RES]] - {content}",
  EXP: "[[EXP]] - {content}",
  THR: "[[THR]] - {content}",
  ART: "[[ART]] - {content}",
  MTD: "[[MTD]] - {content}",
  PAT: "[[PAT]] - {content}",
  HYP: "[[HYP]] - {content}",
  CON: "[[CON]] - {content}",
};
/* eslint-enable @typescript-eslint/naming-convention */

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ExtractedNodeSchema = z.object({
  type: z.enum(NODE_TYPES),
  content: z.string(),
  sourceQuote: z.string().optional(),
  pageNumber: z.number().optional(),
  section: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
});

export type ExtractedNode = z.infer<typeof ExtractedNodeSchema>;

// eslint-disable-next-line @typescript-eslint/naming-convention
export const ExtractionResultSchema = z.object({
  nodes: z.array(ExtractedNodeSchema),
  paperTitle: z.string().optional(),
  paperAuthors: z.array(z.string()).optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export type ExtractionRequest = {
  paperText: string;
  researchQuestion?: string;
  nodeTypes: NodeType[];
  model: string;
}

export type ExtractionResponse = {
  success: boolean;
  data?: ExtractionResult;
  error?: string;
}
