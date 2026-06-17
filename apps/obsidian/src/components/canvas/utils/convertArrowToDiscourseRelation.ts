import type { TFile } from "obsidian";
import { createShapeId, Editor, TLArrowShape, TLShapeId } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseNodeShape } from "~/components/canvas/shapes/DiscourseNodeShape";
import { DiscourseRelationShape } from "~/components/canvas/shapes/DiscourseRelationShape";
import {
  BaseRelationBindingUtil,
  RelationBinding,
} from "~/components/canvas/shapes/DiscourseRelationBinding";
import { createOrUpdateArrowBinding } from "~/components/canvas/utils/relationUtils";
import { persistRelationBetweenNodeShapes } from "~/components/canvas/utils/relationJsonUtils";
import { removeRelationById } from "~/utils/relationsStore";
import {
  getDiscourseNodeTypeId,
  getRelationDirection,
  getRelationLabelForDirection,
  getValidRelationTypesForNodePair,
  isDiscourseNodeShape,
} from "~/components/canvas/utils/relationTypeUtils";
import { getRelationTypeById } from "~/utils/typeUtils";
import { toTldrawColor } from "~/utils/tldrawColors";
import { showToast } from "./toastUtils";

type ResolvedNativeArrowPair = {
  arrow: TLArrowShape;
  startBinding: RelationBinding;
  endBinding: RelationBinding;
  startNode: DiscourseNodeShape;
  endNode: DiscourseNodeShape;
  startNodeTypeId: string;
  endNodeTypeId: string;
};

type ResolveNativeArrowFailureReason =
  | "not-arrow"
  | "unbound"
  | "same-node"
  | "not-discourse-node"
  | "missing-type-id";

const getNativeArrowBindings = (
  editor: Editor,
  arrowId: TLShapeId,
): { start?: RelationBinding; end?: RelationBinding } => {
  const bindings = editor.getBindingsFromShape<RelationBinding>(
    arrowId,
    "arrow",
  );
  return {
    start: bindings.find((b) => b.props.terminal === "start"),
    end: bindings.find((b) => b.props.terminal === "end"),
  };
};

const resolveNativeArrowDiscoursePair = (
  editor: Editor,
  arrowId: TLShapeId,
):
  | { ok: true; value: ResolvedNativeArrowPair }
  | { ok: false; reason: ResolveNativeArrowFailureReason } => {
  const shape = editor.getShape(arrowId);
  if (!shape || shape.type !== "arrow") {
    return { ok: false, reason: "not-arrow" };
  }

  const { start, end } = getNativeArrowBindings(editor, arrowId);
  if (!start || !end) {
    return { ok: false, reason: "unbound" };
  }

  if (start.toId === end.toId) {
    return { ok: false, reason: "same-node" };
  }

  const startNode = editor.getShape(start.toId);
  const endNode = editor.getShape(end.toId);

  if (
    !startNode ||
    !endNode ||
    !isDiscourseNodeShape(startNode) ||
    !isDiscourseNodeShape(endNode)
  ) {
    return { ok: false, reason: "not-discourse-node" };
  }

  const startNodeTypeId = getDiscourseNodeTypeId(startNode);
  const endNodeTypeId = getDiscourseNodeTypeId(endNode);

  if (!startNodeTypeId || !endNodeTypeId) {
    return { ok: false, reason: "missing-type-id" };
  }

  return {
    ok: true,
    value: {
      arrow: shape,
      startBinding: start,
      endBinding: end,
      startNode,
      endNode,
      startNodeTypeId,
      endNodeTypeId,
    },
  };
};

const getResolveFailureMessage = (
  reason: ResolveNativeArrowFailureReason,
): string => {
  switch (reason) {
    case "same-node":
      return "Target must be a different discourse node";
    case "unbound":
    case "not-discourse-node":
      return "Arrow must connect two discourse nodes";
    default:
      return "Could not convert this arrow to a relation";
  }
};

export const getValidRelationTypesForArrow = ({
  editor,
  plugin,
  arrowId,
}: {
  editor: Editor;
  plugin: DiscourseGraphPlugin;
  arrowId: TLShapeId;
}): { id: string; label: string; color: string }[] => {
  const resolved = resolveNativeArrowDiscoursePair(editor, arrowId);
  if (!resolved.ok) return [];

  return getValidRelationTypesForNodePair({
    settings: plugin.settings,
    sourceNodeTypeId: resolved.value.startNodeTypeId,
    targetNodeTypeId: resolved.value.endNodeTypeId,
  });
};

type ConvertArrowToDiscourseRelationArgs = {
  editor: Editor;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  arrowId: TLShapeId;
  relationTypeId: string;
};

export const convertArrowToDiscourseRelation = async ({
  editor,
  plugin,
  canvasFile,
  arrowId,
  relationTypeId,
}: ConvertArrowToDiscourseRelationArgs): Promise<TLShapeId | undefined> => {
  if (editor.getInstanceState().isReadonly) return;

  const resolved = resolveNativeArrowDiscoursePair(editor, arrowId);
  if (!resolved.ok) {
    if (resolved.reason !== "not-arrow") {
      showToast({
        severity: "warning",
        title: "Relation",
        description: getResolveFailureMessage(resolved.reason),
        targetCanvasId: canvasFile.path,
      });
    }
    return;
  }

  const {
    arrow,
    startBinding,
    endBinding,
    startNode,
    endNode,
    startNodeTypeId,
    endNodeTypeId,
  } = resolved.value;

  const relationType = getRelationTypeById(plugin, relationTypeId);
  if (!relationType) return;

  const { direct, reverse } = getRelationDirection({
    discourseRelations: plugin.settings.discourseRelations,
    relationTypeId,
    sourceNodeTypeId: startNodeTypeId,
    targetNodeTypeId: endNodeTypeId,
  });
  const isReverseOnly = reverse && !direct;
  const persistStartNode = isReverseOnly ? endNode : startNode;
  const persistEndNode = isReverseOnly ? startNode : endNode;

  const persistResult = await persistRelationBetweenNodeShapes({
    plugin,
    canvasFile,
    editor,
    startNode: persistStartNode,
    endNode: persistEndNode,
    relationTypeId,
  });

  if (!persistResult.ok) {
    return;
  }

  const relationLabel = getRelationLabelForDirection({
    discourseRelations: plugin.settings.discourseRelations,
    relationType,
    sourceNodeTypeId: startNodeTypeId,
    targetNodeTypeId: endNodeTypeId,
  });

  const color = toTldrawColor(relationType.color);
  const newShapeId = createShapeId();

  editor.run(() => {
    editor.createShape<DiscourseRelationShape>({
      id: newShapeId,
      type: "discourse-relation",
      x: arrow.x,
      y: arrow.y,
      rotation: arrow.rotation,
      parentId: arrow.parentId,
      index: arrow.index,
      opacity: arrow.opacity,
      meta: {
        ...arrow.meta,
        relationInstanceId: persistResult.relationInstanceId,
      },
      props: {
        ...arrow.props,
        relationTypeId,
        color,
        labelColor: color,
        text: relationLabel,
      },
    });

    const createdShape = editor.getShape<DiscourseRelationShape>(newShapeId);
    if (!createdShape) return;

    createOrUpdateArrowBinding(
      editor,
      createdShape,
      startBinding.toId,
      startBinding.props,
    );
    createOrUpdateArrowBinding(
      editor,
      createdShape,
      endBinding.toId,
      endBinding.props,
    );

    editor.deleteShape(arrowId);
    editor.setSelectedShapes([newShapeId]);
  });

  const convertedShape = editor.getShape<DiscourseRelationShape>(newShapeId);
  const arrowStillExists = editor.getShape(arrowId);

  if (!convertedShape || arrowStillExists) {
    if (convertedShape) {
      editor.deleteShape(newShapeId);
    }

    if (!persistResult.alreadyExisted) {
      await removeRelationById(plugin, persistResult.relationInstanceId);
    }

    showToast({
      severity: "error",
      title: "Relation",
      description:
        "Could not convert the arrow on canvas. The relation was not saved.",
      targetCanvasId: canvasFile.path,
    });
    return;
  }

  BaseRelationBindingUtil.markRelationReified(newShapeId);
  editor.markHistoryStoppingPoint("convert arrow to discourse relation");

  if (!persistResult.alreadyExisted) {
    showToast({
      severity: "success",
      title: "Relation Created",
      description: `Added ${relationLabel} relation between ${persistResult.sourceFile.basename} and ${persistResult.targetFile.basename}`,
      targetCanvasId: canvasFile.path,
    });
  }

  return newShapeId;
};
