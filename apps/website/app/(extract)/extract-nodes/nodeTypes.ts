// TEMPORARY: mirrors the shape of NODE_TYPE_DEFINITIONS being added in
// ENG-1595 (apps/website/app/types/extraction.ts). Delete this file and
// update imports to "~/types/extraction" once ENG-1595 merges to main.

export type NodeTypeDefinition = {
  label: string;
  candidateTag: string;
  color: string;
};

export const NODE_TYPE_DEFINITIONS: NodeTypeDefinition[] = [
  { label: "Claim", candidateTag: "#clm-candidate", color: "#7DA13E" },
  { label: "Question", candidateTag: "#que-candidate", color: "#99890E" },
  { label: "Hypothesis", candidateTag: "#hyp-candidate", color: "#7C4DFF" },
  { label: "Evidence", candidateTag: "#evd-candidate", color: "#dc0c4a" },
  { label: "Result", candidateTag: "#res-candidate", color: "#E6A23C" },
  { label: "Source", candidateTag: "#src-candidate", color: "#9E9E9E" },
  { label: "Theory", candidateTag: "#the-candidate", color: "#8B5CF6" },
];
