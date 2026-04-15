// TEMPORARY: mirrors the shape of NODE_TYPE_DEFINITIONS being added in
// ENG-1595 (apps/website/app/types/extraction.ts). Delete this file and
// update imports to "~/types/extraction" once ENG-1595 merges to main.

export type NodeTypeDefinition = {
  label: string;
  definition: string;
  candidateTag: string;
  color?: string;
};

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
