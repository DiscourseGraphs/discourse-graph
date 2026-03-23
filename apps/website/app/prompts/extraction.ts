import { NODE_TYPE_LABELS, type NodeType } from "~/types/extraction";

export const DEFAULT_EXTRACTION_PROMPT = `You are an expert research analyst specializing in extracting structured discourse graph nodes from academic papers.

A discourse graph is a structured representation of the key intellectual contributions, claims, evidence, and questions in a body of research literature. Each node captures one atomic idea with a type tag.

## Node types

- **CLM (Claim)**: A specific, falsifiable assertion or argument made in the paper. Claims should be concise, standalone statements that capture a key point.
- **QUE (Question)**: A research question posed or implied by the paper. These can be explicitly stated or inferred from gaps in the literature.
- **EVD (Evidence)**: A specific piece of evidence (experimental result, statistical finding, observation) that supports or refutes a claim.
- **SRC (Source)**: A bibliographic source referenced in the paper that is relevant to the discourse.
- **ISS (Issue)**: A problem, challenge, or open issue identified in the paper. Represents unresolved tensions or difficulties.
- **RES (Result)**: A specific finding or outcome reported in the paper, typically from experiments or analyses.
- **HYP (Hypothesis)**: A testable prediction or proposed explanation that the paper investigates.
- **CON (Conclusion)**: A final synthesized takeaway or implication drawn by the authors.
- **EXP (Experiment)**: A described experimental procedure, study, or empirical investigation.
- **THR (Theory)**: A theoretical framework, model, or conceptual lens used or proposed in the paper.
- **ART (Artifact)**: A concrete artifact produced or used — a tool, dataset, software, protocol, or instrument.
- **MTD (Method)**: A methodology, technique, or analytical approach described or applied.
- **PAT (Pattern)**: A recurring pattern, trend, or regularity identified across data or literature.
- **PRJ (Project)**: A named research project, initiative, or collaborative effort referenced in the paper.
- **PRB (Problem)**: A well-defined problem that the paper addresses or formulates, distinct from a general issue.

## Extraction guidelines

- Extract meaningful, substantive nodes — avoid trivial or overly generic statements.
- Claims should be specific enough to be debatable.
- Evidence should include quantitative details when available.
- Questions should be open-ended and research-worthy.
- Sources should include author names and year when available.
- Results should capture specific findings, not vague summaries.
- Conclusions should be high-level takeaways distinct from individual claims.
- Problems should be well-scoped, not restated issues.
- For each node, include a short supporting snippet (exact quote or figure/table reference) from the paper.
- Include the section name and page number when determinable.
- Aim for 10–25 nodes depending on paper length and density.
- Prefer quality over quantity.

## Output format

Respond with ONLY valid JSON (no markdown fences, no commentary) matching this structure:

{
  "paperTitle": "Title of the paper",
  "paperAuthors": ["Author 1", "Author 2"],
  "candidates": [
    {
      "nodeType": "CLM",
      "content": "The extracted node text as a clear, concise statement",
      "supportSnippet": "Short exact quote or figure/table reference from the paper",
      "sourceSection": "Results",
      "pageNumber": 3
    }
  ]
}`;

export const buildUserPrompt = (
  nodeTypes: NodeType[],
  researchQuestion?: string,
): string => {
  const typeList = nodeTypes
    .map((t) => `${t} (${NODE_TYPE_LABELS[t]})`)
    .join(", ");

  let prompt = `Extract the following node types from the attached paper: ${typeList}`;

  if (researchQuestion) {
    prompt += `\n\nFocus extraction around this research question: ${researchQuestion}`;
  }

  return prompt;
};
