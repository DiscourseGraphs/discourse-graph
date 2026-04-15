import type { NodeTypeDefinition } from "~/types/extraction";

const QUALITY_CRITERIA = `Atomic: one idea per node. Split compound sentences.
Self-contained: understandable without the paper.
Faithful: no inference or editorializing.
Specific: "X reduced Y by 43% in Z" not "X was effective."
8–25 nodes. Quality over quantity. Cover all sections.
For evidence: include the observation, model, system, and method, in past tense`;

const FEW_SHOT_EXAMPLES = `<example>
Excerpt (Results):
"CRISPR-edited T cells maintained cytotoxic activity for 12 weeks in vitro (Fig 3A), longer than controls which declined after week 4 (p<0.001). This correlated with elevated CD62L and CCR7 (Fig 3B), suggesting a memory-like phenotype resisting exhaustion."
{
"nodes": [
{
  "nodeType": "Result",
  "content": "CRISPR-edited T cells maintained cytotoxic activity for 12 weeks in vitro, significantly longer than unedited controls which declined after week 4",
  "supportSnippet": "CRISPR-edited T cells maintained cytotoxic activity for 12 weeks in vitro (Fig 3A), longer than controls which declined after week 4 (p<0.001)",
  "sourceSection": "Results"
},
{
  "nodeType": "Result",
  "content": "Sustained cytotoxic activity of CRISPR-edited T cells correlated with elevated CD62L and CCR7 expression",
  "supportSnippet": "This correlated with elevated CD62L and CCR7 (Fig 3B)",
  "sourceSection": "Results"
},
{
  "nodeType": "Claim",
  "content": "CRISPR editing may promote a memory-like T cell phenotype that resists exhaustion",
  "supportSnippet": "suggesting a memory-like phenotype resisting exhaustion",
  "sourceSection": "Results"
}
]
}
</example>
<example>
Excerpt (Results):
"The AFM analysis showed that the light chain-free lattice reached a height of approximately 6 nm above the carbon film, and when nano newton-range orthogonal forces were applied, it exhibited significant resistance to further compression compared to lattices constructed from native clathrin with light chains, which could be compressed reversibly from 12 nm to 6 nm in height."
{
"nodes": [
{
  "nodeType": "Result",
  "content": "Applying force to clathrin lattices on carbon-coated films caused a larger change in height when clathrin light chain was also present based on AFM",
  "supportSnippet": "it exhibited significant resistance to further compression compared to lattices constructed from native clathrin with light chains, which could be compressed reversibly from 12 nm to 6 nm in height",
  "sourceSection": "Results"
},
{
  "nodeType": "Claim",
  "content": "Clathrin light chain increases the rigidity of clathrin-coated vesicles",
  "supportSnippet": "The vertical elasticity of the clathrin lattice is dependent on clathrin light chains, suggesting that light chains are important for both, the conformational stability of the clathrin triskelion and that of the lattice.",
  "sourceSection": "Results"
}
]
}
</example>
<example>
Excerpt (Results):
"We found that under low tension (0.015 pN/nm), endocytic pits internalize strongly and few barbed ends encounter the base of the pit, with fewer Arp2/3 complexes recruited to the network and a correspondingly low filament bending energy (Figure 7H). Under >50 x higher membrane tension (1 pN/nm), endocytic internalization slowed but was not abolished. For these pits, more barbed ends encountered the base of the pit, binding more Arp2/3 complexes to nucleate more actin filaments and increasing the total actin filament bending energy near the base of the pit (Figure 7H)."
{
"nodes": [
{
  "nodeType": "Result",
  "content": "Total bending energy of actin filaments increased as a function of membrane tension in endocytic simulations",
  "supportSnippet": "Under >50 x higher membrane tension (1 pN/nm), endocytic internalization slowed but was not abolished. For these pits, more barbed ends encountered the base of the pit, binding more Arp2/3 complexes to nucleate more actin filaments and increasing the total actin filament bending energy near the base of the pit (Figure 7H).",
  "sourceSection": "Results"
},
{
  "nodeType": "Claim",
  "content": "Actin filament bending energy associated with endocytic internalization increases with membrane tension",
  "supportSnippet": "Here, the distribution of Hip1R linkers around the pit directs more filaments to grow toward the base of the pit (Figure 4), which nucleates more filaments autocatalytically and increases filament bending (Figure 5)",
  "sourceSection": "Results"
}
]
}
</example>
<example>
Excerpt (Results):
"Pangram's text classifier is the only model that achieves production-ready levels of accuracy, false positive rate, and false negative rate. Our model is the most accurate at 99%, compared to commercial competitors which do not even clear 95%. Our false positive rate is better than the second best model, GPTZero, by a factor of 3, which achieving 7 times better negative error rate."
{
"nodes": [
{
  "nodeType": "Result",
  "content": "Pangram had a lower false positive and false negative rate in detecting AI-generated writing than GPTZero, Originality, or DetectGPT, based on classification of 2000 test documents",
  "supportSnippet": " Our model is the most accurate at 99%, compared to commercial competitors which do not even clear 95%. Our false positive rate is better than the second best model, GPTZero, by a factor of 3, which achieving 7 times better negative error rate.",
  "sourceSection": "Results"
},
{
  "nodeType": "Claim",
  "content": "Pangram achieves higher accuracy and fewer false positives than other AI writing detection algorithms",
  "supportSnippet": " Pangram Text outperforms zero-shot methods such as DetectGPT as well as leading commercial AI detection tools with over 38 times lower error rates on a comprehensive benchmark comprised of 10 text domains (student writing, creative writing, scientific writing, books, encyclopedias, news, email, scientific papers, short-form Q&A) and 8 open and closed-source large language models",
  "sourceSection": "Abstract"
}
]
}
</example>`;

export const buildSystemPrompt = (nodeTypes: NodeTypeDefinition[]): string => {
  const nodeTypesBlock = nodeTypes
    .map((t) => `${t.label}: ${t.definition}`)
    .join("\n");

  return `You are a research analyst extracting discourse graph nodes from academic papers.
Extract discrete, atomic nodes from the paper. Each node is one idea: one claim, one observation, one question.
<node-types>
${nodeTypesBlock}
</node-types>
<quality>
${QUALITY_CRITERIA}
</quality>
<examples>
${FEW_SHOT_EXAMPLES}
</examples>`;
};

export const buildUserPrompt = (researchQuestion?: string): string => {
  let prompt = "Extract discourse graph nodes from the attached paper.";

  if (researchQuestion) {
    prompt += `\n\nFocus extraction around this research question: ${researchQuestion}`;
  }

  return prompt;
};
