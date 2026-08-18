export const NODE_TYPES = ["question", "claim", "evidence", "source"] as const;

export const RELATIONSHIP_TYPES = [
  "supports",
  "challenges",
  "cites",
  "relates_to",
] as const;

export type NodeType = (typeof NODE_TYPES)[number];
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

export type DiscourseLink = {
  targetId: string;
  type: RelationshipType;
};

export type DiscourseNode = {
  id: string;
  links: DiscourseLink[];
  parentId: string | null;
  sourceUrl?: string;
  text: string;
  type: NodeType;
};

const SEED_NODES: DiscourseNode[] = [
  {
    id: "question-preregistration",
    type: "question",
    text: "How does preregistration change the credibility of scientific findings?",
    parentId: null,
    links: [],
  },
  {
    id: "claim-transparency",
    type: "claim",
    text: "Preregistration makes planned analyses easier to distinguish from choices made after seeing the results.",
    parentId: "question-preregistration",
    links: [{ targetId: "question-preregistration", type: "relates_to" }],
  },
  {
    id: "evidence-registered-reports",
    type: "evidence",
    text: "Registered reports review the research question and methods before the results are known.",
    parentId: "claim-transparency",
    links: [
      { targetId: "claim-transparency", type: "supports" },
      { targetId: "source-nosek", type: "cites" },
    ],
  },
  {
    id: "source-nosek",
    type: "source",
    text: "Nosek et al. (2018), The preregistration revolution",
    parentId: "evidence-registered-reports",
    sourceUrl: "https://doi.org/10.1073/pnas.1708274114",
    links: [],
  },
  {
    id: "claim-not-guarantee",
    type: "claim",
    text: "Preregistration is a transparency tool, not a guarantee that a study uses strong methods.",
    parentId: "question-preregistration",
    links: [
      { targetId: "question-preregistration", type: "relates_to" },
      { targetId: "claim-transparency", type: "challenges" },
    ],
  },
  {
    id: "evidence-specificity",
    type: "evidence",
    text: "A plan can be too vague to constrain analysis, while disclosed and justified deviations can still be informative.",
    parentId: "claim-not-guarantee",
    links: [
      { targetId: "claim-not-guarantee", type: "supports" },
      { targetId: "source-chambers", type: "cites" },
    ],
  },
  {
    id: "source-chambers",
    type: "source",
    text: "Chambers & Tzavella (2022), The past, present and future of Registered Reports",
    parentId: "evidence-specificity",
    sourceUrl: "https://doi.org/10.1038/s41562-021-01193-7",
    links: [],
  },
  {
    id: "question-deviations",
    type: "question",
    text: "When should a researcher deviate from a preregistered plan?",
    parentId: "question-preregistration",
    links: [
      { targetId: "claim-not-guarantee", type: "relates_to" },
      { targetId: "evidence-specificity", type: "relates_to" },
    ],
  },
];

export const getSeedNodes = (): DiscourseNode[] =>
  SEED_NODES.map((node) => ({
    ...node,
    links: node.links.map((link) => ({ ...link })),
  }));

export const addRelationship = ({
  nodes,
  sourceId,
  targetId,
  type,
}: {
  nodes: DiscourseNode[];
  sourceId: string;
  targetId: string;
  type: RelationshipType;
}): DiscourseNode[] => {
  if (sourceId === targetId) return nodes;

  return nodes.map((node) => {
    if (node.id !== sourceId) return node;

    const alreadyExists = node.links.some(
      (link) => link.targetId === targetId && link.type === type,
    );

    return alreadyExists
      ? node
      : { ...node, links: [...node.links, { targetId, type }] };
  });
};

export const removeRelationship = ({
  nodes,
  sourceId,
  targetId,
  type,
}: {
  nodes: DiscourseNode[];
  sourceId: string;
  targetId: string;
  type: RelationshipType;
}): DiscourseNode[] =>
  nodes.map((node) =>
    node.id === sourceId
      ? {
          ...node,
          links: node.links.filter(
            (link) => link.targetId !== targetId || link.type !== type,
          ),
        }
      : node,
  );

export const deleteNode = ({
  nodeId,
  nodes,
}: {
  nodeId: string;
  nodes: DiscourseNode[];
}): DiscourseNode[] => {
  const deletedNode = nodes.find((node) => node.id === nodeId);
  if (!deletedNode) return nodes;

  return nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({
      ...node,
      parentId: node.parentId === nodeId ? deletedNode.parentId : node.parentId,
      links: node.links.filter((link) => link.targetId !== nodeId),
    }));
};
