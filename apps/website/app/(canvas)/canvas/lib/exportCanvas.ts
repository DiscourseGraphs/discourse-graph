export const NODE_TYPES = ["question", "claim", "evidence"] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export type ExportNode = {
  id: string;
  text: string;
  type: NodeType;
};

export type ExportRelation = {
  fromId: string;
  label: string;
  toId: string;
};

export type CanvasExport = {
  nodes: ExportNode[];
  relations: ExportRelation[];
};

export type ExportTarget = "obsidian" | "roam";

const NODE_LABELS: Record<NodeType, string> = {
  claim: "Claim",
  evidence: "Evidence",
  question: "Question",
};

const ROAM_TAGS: Record<NodeType, string> = {
  claim: "CLM",
  evidence: "EVD",
  question: "QUE",
};

const normalizeText = (value: string, fallback: string): string =>
  value.replace(/\s+/g, " ").trim() || fallback;

const getRelationsBySource = ({
  relations,
}: {
  relations: ExportRelation[];
}): Map<string, ExportRelation[]> => {
  const relationsBySource = new Map<string, ExportRelation[]>();
  for (const relation of relations) {
    const sourceRelations = relationsBySource.get(relation.fromId) ?? [];
    sourceRelations.push(relation);
    relationsBySource.set(relation.fromId, sourceRelations);
  }
  return relationsBySource;
};

export const formatCanvasExport = ({
  canvas,
  target,
}: {
  canvas: CanvasExport;
  target: ExportTarget;
}): string => {
  if (!canvas.nodes.length) return "";

  const nodesById = new Map(canvas.nodes.map((node) => [node.id, node]));
  const relationsBySource = getRelationsBySource({
    relations: canvas.relations,
  });

  return canvas.nodes
    .flatMap((node) => {
      const nodeText = normalizeText(
        node.text,
        `Untitled ${NODE_LABELS[node.type]}`,
      );
      const nodeLine =
        target === "roam"
          ? `- [[${ROAM_TAGS[node.type]}]] - ${nodeText}`
          : `- **${NODE_LABELS[node.type]}:** ${nodeText}`;
      const relationLines = (relationsBySource.get(node.id) ?? []).flatMap(
        (relation) => {
          const destination = nodesById.get(relation.toId);
          if (!destination) return [];

          const label = normalizeText(relation.label, "Relates to");
          const destinationText = normalizeText(
            destination.text,
            `Untitled ${NODE_LABELS[destination.type]}`,
          );
          return target === "roam"
            ? `  - ${label}:: [[${ROAM_TAGS[destination.type]}]] - ${destinationText}`
            : `  - ${label} ? **${NODE_LABELS[destination.type]}:** ${destinationText}`;
        },
      );

      return [nodeLine, ...relationLines];
    })
    .join("\n");
};
