import type {
  DiscourseRelation,
  DiscourseRelationType,
  RelationInstance,
} from "~/types";

export type NodeCardContextMenuTab = "context" | "styling";

export type NodeCardContextMenuState = {
  activeTab: NodeCardContextMenuTab;
  selectedShapeId: string | null;
};

export const nodeCardContextMenuReducer = (
  state: NodeCardContextMenuState,
  action:
    | { type: "select-tab"; tab: NodeCardContextMenuTab }
    | { type: "select-node"; selectedShapeId: string | null },
): NodeCardContextMenuState => {
  if (action.type === "select-tab") {
    return { ...state, activeTab: action.tab };
  }

  return action.selectedShapeId === state.selectedShapeId
    ? state
    : { activeTab: "context", selectedShapeId: action.selectedShapeId };
};

export const shouldShowNodeCardContextMenu = (
  isEnabled: boolean,
  selectedShapeType?: string,
) => isEnabled && selectedShapeType === "discourse-node";

export const runRelationCanvasAction = async ({
  hasExistingRelation,
  add,
  remove,
}: {
  hasExistingRelation: boolean;
  add: () => Promise<void>;
  remove: () => Promise<void>;
}) => {
  await (hasExistingRelation ? remove() : add());
};

type GroupedRelationInput<TFile> = {
  activeNodeTypeId: string;
  nodeInstanceId: string;
  relationTypes: Pick<DiscourseRelationType, "id" | "label" | "complement">[];
  discourseRelations: Pick<
    DiscourseRelation,
    "sourceId" | "destinationId" | "relationshipTypeId"
  >[];
  relations: Pick<RelationInstance, "type" | "source" | "destination">[];
  getLinkedFile: (nodeInstanceId: string) => TFile | null;
  includeAllDirections?: boolean;
};

type GroupedRelation<TFile extends { path: string }> = {
  key: string;
  label: string;
  isSource: boolean;
  relationTypeId: string;
  linkedFiles: TFile[];
};

export const groupRelationsByType = <TFile extends { path: string }>({
  activeNodeTypeId,
  nodeInstanceId,
  relationTypes,
  discourseRelations,
  relations,
  getLinkedFile,
  includeAllDirections = false,
}: GroupedRelationInput<TFile>): GroupedRelation<TFile>[] => {
  const result = new Map<string, GroupedRelation<TFile>>();

  for (const relationType of relationTypes) {
    const matchingRelations = discourseRelations.filter(
      ({ sourceId, destinationId, relationshipTypeId }) =>
        relationshipTypeId === relationType.id &&
        (sourceId === activeNodeTypeId || destinationId === activeNodeTypeId),
    );
    const directions = includeAllDirections
      ? new Set(
          matchingRelations.flatMap(({ sourceId, destinationId }) => [
            ...(sourceId === activeNodeTypeId ? [true] : []),
            ...(destinationId === activeNodeTypeId ? [false] : []),
          ]),
        )
      : new Set(
          matchingRelations[0]
            ? [matchingRelations[0].sourceId === activeNodeTypeId]
            : [],
        );

    for (const isSource of directions) {
      const group: GroupedRelation<TFile> = {
        key: `${relationType.id}-${isSource}`,
        label: isSource ? relationType.label : relationType.complement,
        isSource,
        relationTypeId: relationType.id,
        linkedFiles: [],
      };

      for (const relation of relations) {
        if (relation.type !== relationType.id) continue;
        const otherId = includeAllDirections
          ? isSource && relation.source === nodeInstanceId
            ? relation.destination
            : !isSource && relation.destination === nodeInstanceId
              ? relation.source
              : null
          : relation.source === nodeInstanceId
            ? relation.destination
            : relation.source;
        const linkedFile = otherId ? getLinkedFile(otherId) : null;
        if (
          linkedFile &&
          !group.linkedFiles.some(({ path }) => path === linkedFile.path)
        ) {
          group.linkedFiles.push(linkedFile);
        }
      }

      result.set(group.key, group);
    }
  }

  return [...result.values()];
};
