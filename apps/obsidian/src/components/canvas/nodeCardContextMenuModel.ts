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

export type NodeCardContextMenuAction =
  | {
      type: "select-tab";
      tab: NodeCardContextMenuTab;
    }
  | {
      type: "sync-selection";
      selectedShapeId: string | null;
    };

export const createNodeCardContextMenuState = (
  selectedShapeId: string | null,
): NodeCardContextMenuState => ({
  activeTab: "context",
  selectedShapeId,
});

export const nodeCardContextMenuReducer = (
  state: NodeCardContextMenuState,
  action: NodeCardContextMenuAction,
): NodeCardContextMenuState => {
  if (action.type === "select-tab") {
    return {
      ...state,
      activeTab: action.tab,
    };
  }

  if (action.selectedShapeId === state.selectedShapeId) {
    return state;
  }

  return createNodeCardContextMenuState(action.selectedShapeId);
};

export const shouldShowNodeCardContextMenu = ({
  isEnabled,
  selectedShapeType,
}: {
  isEnabled: boolean;
  selectedShapeType: string | undefined;
}): boolean => isEnabled && selectedShapeType === "discourse-node";

export type RelationCanvasAction = "add" | "remove";

export const getRelationCanvasAction = (
  hasExistingRelation: boolean,
): RelationCanvasAction => (hasExistingRelation ? "remove" : "add");

export const runRelationCanvasAction = async ({
  hasExistingRelation,
  add,
  remove,
}: {
  hasExistingRelation: boolean;
  add: () => Promise<void>;
  remove: () => Promise<void>;
}): Promise<RelationCanvasAction> => {
  const action = getRelationCanvasAction(hasExistingRelation);
  await (action === "add" ? add() : remove());
  return action;
};

type RelationTypeSummary = Pick<
  DiscourseRelationType,
  "id" | "label" | "complement"
>;

type DiscourseRelationSummary = Pick<
  DiscourseRelation,
  "sourceId" | "destinationId" | "relationshipTypeId"
>;

type RelationInstanceSummary = Pick<
  RelationInstance,
  "type" | "source" | "destination"
>;

export type GroupedRelation<TLinkedFile extends { path: string }> = {
  key: string;
  label: string;
  isSource: boolean;
  relationTypeId: string;
  linkedFiles: TLinkedFile[];
};

export const groupRelationsByType = <
  TLinkedFile extends {
    path: string;
  },
>({
  activeNodeTypeId,
  nodeInstanceId,
  relationTypes,
  discourseRelations,
  relations,
  getLinkedFile,
}: {
  activeNodeTypeId: string;
  nodeInstanceId: string;
  relationTypes: RelationTypeSummary[];
  discourseRelations: DiscourseRelationSummary[];
  relations: RelationInstanceSummary[];
  getLinkedFile: (nodeInstanceId: string) => TLinkedFile | null;
}): GroupedRelation<TLinkedFile>[] => {
  const result: GroupedRelation<TLinkedFile>[] = [];

  for (const relationType of relationTypes) {
    const directions = new Set<boolean>();

    for (const relation of discourseRelations) {
      if (relation.relationshipTypeId !== relationType.id) continue;
      if (relation.sourceId === activeNodeTypeId) directions.add(true);
      if (relation.destinationId === activeNodeTypeId) directions.add(false);
    }

    for (const isSource of directions) {
      const group: GroupedRelation<TLinkedFile> = {
        key: `${relationType.id}-${isSource ? "source" : "destination"}`,
        label: isSource ? relationType.label : relationType.complement,
        isSource,
        relationTypeId: relationType.id,
        linkedFiles: [],
      };

      for (const relation of relations) {
        if (relation.type !== relationType.id) continue;

        const otherNodeInstanceId = isSource
          ? relation.source === nodeInstanceId
            ? relation.destination
            : null
          : relation.destination === nodeInstanceId
            ? relation.source
            : null;

        if (!otherNodeInstanceId) continue;

        const linkedFile = getLinkedFile(otherNodeInstanceId);
        if (
          linkedFile &&
          !group.linkedFiles.some(({ path }) => path === linkedFile.path)
        ) {
          group.linkedFiles.push(linkedFile);
        }
      }

      result.push(group);
    }
  }

  return result;
};
