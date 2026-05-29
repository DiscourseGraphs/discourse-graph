import {
  DefaultColorThemePalette,
  Editor,
  TLShapeId,
  createShapeId,
} from "tldraw";
import {
  BaseDiscourseRelationUtil,
  DiscourseRelationShape,
  getRelationColor,
} from "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil";
import { createOrUpdateArrowBinding } from "~/components/canvas/DiscourseRelationShape/helpers";
import {
  checkConnectionType,
  getAllRelations,
  isDiscourseNodeShape,
} from "~/components/canvas/canvasUtils";
import type { DiscourseRelation } from "~/utils/getDiscourseRelations";

type RelationTypeOption = { id: string; label: string; color: string };

type DirectionalRelation = Pick<
  DiscourseRelation,
  "label" | "complement" | "source" | "destination"
>;

export const getDirectionalRelationLabel = ({
  relation,
  sourceNodeType,
  targetNodeType,
}: {
  relation: DirectionalRelation;
  sourceNodeType: string;
  targetNodeType: string;
}): string => {
  const { isReverse } = checkConnectionType(
    relation,
    sourceNodeType,
    targetNodeType,
  );
  return isReverse && relation.complement
    ? relation.complement
    : relation.label;
};

export const persistRelationArrow = async ({
  editor,
  arrow,
  targetId,
}: {
  editor: Editor;
  arrow: DiscourseRelationShape;
  targetId: TLShapeId;
}): Promise<void> => {
  const util = editor.getShapeUtil(arrow);
  if (
    util instanceof BaseDiscourseRelationUtil &&
    "handleCreateRelationsInRoam" in util
  ) {
    type UtilWithRoamPersistence = BaseDiscourseRelationUtil & {
      handleCreateRelationsInRoam: (args: {
        arrow: DiscourseRelationShape;
        targetId: TLShapeId;
      }) => Promise<void>;
    };
    await (util as UtilWithRoamPersistence).handleCreateRelationsInRoam({
      arrow,
      targetId,
    });
  }
};

export const getValidRelationTypesBetween = (
  editor: Editor,
  startId: TLShapeId,
  endId: TLShapeId,
): RelationTypeOption[] => {
  const startNode = editor.getShape(startId);
  const endNode = editor.getShape(endId);
  if (!startNode || !endNode) return [];
  if (
    !isDiscourseNodeShape(editor, startNode) ||
    !isDiscourseNodeShape(editor, endNode)
  )
    return [];

  const colorPalette = DefaultColorThemePalette.lightMode;
  const validTypes: RelationTypeOption[] = [];
  const seenLabels = new Set<string>();

  for (const relation of getAllRelations()) {
    const { isDirect, isReverse } = checkConnectionType(
      relation,
      startNode.type,
      endNode.type,
    );
    if (!isDirect && !isReverse) continue;

    const label = getDirectionalRelationLabel({
      relation,
      sourceNodeType: startNode.type,
      targetNodeType: endNode.type,
    });
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);

    const hexColor =
      colorPalette[getRelationColor(relation.label)]?.solid ?? "#333";
    validTypes.push({ id: relation.id, label, color: hexColor });
  }

  return validTypes;
};

export const createDefaultRelationBetweenNodes = async ({
  editor,
  relationId,
  sourceId,
  targetId,
}: {
  editor: Editor;
  relationId: string;
  sourceId: TLShapeId;
  targetId: TLShapeId;
}): Promise<TLShapeId | null> => {
  const selectedRelation = getAllRelations().find((r) => r.id === relationId);
  if (!selectedRelation) return null;

  const sourceNode = editor.getShape(sourceId);
  const targetNode = editor.getShape(targetId);
  if (!sourceNode || !targetNode) return null;
  const label = getDirectionalRelationLabel({
    relation: selectedRelation,
    sourceNodeType: sourceNode.type,
    targetNodeType: targetNode.type,
  });

  const sourceBounds = editor.getShapePageBounds(sourceId);
  if (!sourceBounds) return null;

  const arrowId = createShapeId();
  editor.createShape<DiscourseRelationShape>({
    id: arrowId,
    type: relationId,
    x: sourceBounds.midX,
    y: sourceBounds.midY,
    props: {
      color: getRelationColor(selectedRelation.label),
      text: label,
      dash: "draw",
      size: "m",
      fill: "none",
      bend: 0,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
      labelPosition: 0.5,
      font: "draw",
      scale: 1,
    },
  });

  const newArrow = editor.getShape<DiscourseRelationShape>(arrowId);
  if (!newArrow) return null;

  createOrUpdateArrowBinding(editor, newArrow, sourceId, {
    terminal: "start",
    normalizedAnchor: { x: 0.5, y: 0.5 },
    isPrecise: false,
    isExact: false,
  });
  createOrUpdateArrowBinding(editor, newArrow, targetId, {
    terminal: "end",
    normalizedAnchor: { x: 0.5, y: 0.5 },
    isPrecise: false,
    isExact: false,
  });

  editor.select(arrowId);

  await persistRelationArrow({ editor, arrow: newArrow, targetId });

  // handleCreateRelationsInRoam deletes the new arrow if it rejects the
  // conversion, so a surviving shape means the relation was persisted.
  return editor.getShape(arrowId) ? arrowId : null;
};
