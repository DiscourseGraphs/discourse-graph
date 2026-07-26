/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// TODO rename/move this file to discourseMigrations.ts
// as it is used for both relation and node shapes
import {
  createMigrationSequence,
  createBindingId,
  TLShapeId,
  VecModel,
  TLBaseShape,
} from "tldraw";
import { createMigrationIds } from "tldraw";
import {
  DISCOURSE_RELATION_SHAPE_TYPE,
  getRelationColor,
} from "./DiscourseRelationUtil";
import { DISCOURSE_NODE_SHAPE_TYPE } from "~/components/canvas/DiscourseNodeUtil";
import type { RelationBinding } from "./DiscourseRelationBindings";

const SEQUENCE_ID_BASE = "com.roam-research.discourse-graphs";

const getRecordType = (record: unknown): string | undefined => {
  if (typeof record !== "object" || record === null) return undefined;
  const candidate = (record as { type?: unknown }).type;
  return typeof candidate === "string" ? candidate : undefined;
};

const getRecordTypeName = (record: unknown): string | undefined => {
  if (typeof record !== "object" || record === null) return undefined;
  const candidate = (record as { typeName?: unknown }).typeName;
  return typeof candidate === "string" ? candidate : undefined;
};

const hasArrowLikeProps = (record: unknown): boolean => {
  if (typeof record !== "object" || record === null) return false;
  const props = (record as { props?: unknown }).props;
  if (typeof props !== "object" || props === null) return false;
  return (
    "start" in props &&
    "end" in props &&
    "arrowheadEnd" in props &&
    ("bend" in props || "labelPosition" in props || "text" in props)
  );
};

const isIgnoredArrowLikeShapeType = ({
  recordType,
  allNodeTypes,
}: {
  recordType: string;
  allNodeTypes: string[];
}): boolean => {
  return (
    recordType === "arrow" ||
    recordType === DISCOURSE_RELATION_SHAPE_TYPE ||
    recordType === DISCOURSE_NODE_SHAPE_TYPE ||
    allNodeTypes.includes(recordType)
  );
};

const isLegacyRelationOrReferencedShape = ({
  record,
  allRelationIds,
  allAddReferencedNodeActions,
  allNodeTypes,
}: {
  record: unknown;
  allRelationIds: string[];
  allAddReferencedNodeActions: string[];
  allNodeTypes: string[];
}): boolean => {
  const recordType = getRecordType(record);
  if (getRecordTypeName(record) !== "shape" || !recordType) return false;
  if (
    [...allRelationIds, ...allAddReferencedNodeActions].includes(recordType)
  ) {
    return true;
  }
  return (
    hasArrowLikeProps(record) &&
    !isIgnoredArrowLikeShapeType({ recordType, allNodeTypes })
  );
};

const isLegacyCanonicalRelationShape = ({
  record,
  allRelationIds,
  allAddReferencedNodeActions,
  allNodeTypes,
}: {
  record: unknown;
  allRelationIds: string[];
  allAddReferencedNodeActions: string[];
  allNodeTypes: string[];
}): boolean => {
  const recordType = getRecordType(record);
  if (getRecordTypeName(record) !== "shape" || !recordType) return false;
  if (allRelationIds.includes(recordType)) return true;
  if (allAddReferencedNodeActions.includes(recordType)) return false;
  return (
    hasArrowLikeProps(record) &&
    !isIgnoredArrowLikeShapeType({ recordType, allNodeTypes })
  );
};

export const migrateRelationTypesToDiscourseRelation = ({
  oldStore,
  allRelationIds,
  allAddReferencedNodeActions,
  allNodeTypes,
}: {
  oldStore: Record<string, any>;
  allRelationIds: string[];
  allAddReferencedNodeActions: string[];
  allNodeTypes: string[];
}): void => {
  const migratedRelationTypeIdsByShapeId = new Map<TLShapeId, string>();

  for (const record of Object.values(oldStore)) {
    if (
      !isLegacyCanonicalRelationShape({
        record,
        allRelationIds,
        allAddReferencedNodeActions,
        allNodeTypes,
      })
    ) {
      continue;
    }

    const shape = record;
    const relationTypeId = shape.props?.relationTypeId || shape.type;
    if (!shape.props) shape.props = {};
    shape.props.relationTypeId = relationTypeId;
    shape.type = DISCOURSE_RELATION_SHAPE_TYPE;
    migratedRelationTypeIdsByShapeId.set(shape.id, relationTypeId);
  }

  for (const record of Object.values(oldStore)) {
    if (getRecordTypeName(record) !== "binding") continue;

    const binding = record as RelationBinding;
    if (!migratedRelationTypeIdsByShapeId.has(binding.fromId)) {
      continue;
    }
    binding.type = DISCOURSE_RELATION_SHAPE_TYPE;
  }
};

export const createMigrations = ({
  allRelationIds,
  allAddReferencedNodeActions,
  allNodeTypes,
}: {
  allRelationIds: string[];
  allAddReferencedNodeActions: string[];
  allNodeTypes: string[];
}) => {
  const versions = createMigrationIds(`${SEQUENCE_ID_BASE}`, {
    ExtractBindings: 1,
    "2.3.0": 2,
    AddSizeAndFontFamily: 3,
    RemoveNullAssetFileSize: 4,
    MigrateNodeTypeToDiscourseNode: 5,
    MigrateRelationTypeToDiscourseRelation: 6,
  });
  return createMigrationSequence({
    sequenceId: `${SEQUENCE_ID_BASE}`,
    sequence: [
      {
        id: versions["ExtractBindings"],
        scope: "store",
        up: (oldStore) => {
          type OldArrowTerminal =
            | { type: "point"; x: number; y: number }
            | {
                type: "binding";
                boundShapeId: TLShapeId;
                normalizedAnchor: VecModel;
                isExact: boolean;
                isPrecise: boolean;
              }
            // new type:
            | { type?: undefined; x: number; y: number };

          type OldArrow = TLBaseShape<
            string,
            { start: OldArrowTerminal; end: OldArrowTerminal }
          >;

          const arrows = Object.values(oldStore).filter((r): r is OldArrow => {
            return isLegacyRelationOrReferencedShape({
              record: r,
              allRelationIds,
              allAddReferencedNodeActions,
              allNodeTypes,
            });
          });

          for (const a of arrows) {
            const arrow = a as unknown as OldArrow;
            const { start, end } = arrow.props;

            // TODO: do we have any that are not binding?
            if (start.type === "binding") {
              const id = createBindingId();
              const binding: RelationBinding = {
                typeName: "binding",
                id,
                type: arrow.type,
                fromId: arrow.id,
                toId: start.boundShapeId,
                meta: {},
                props: {
                  terminal: "start",
                  normalizedAnchor: start.normalizedAnchor,
                  isExact: start.isExact || false,
                  isPrecise: start.isPrecise || false,
                },
              };
              oldStore[id] = binding;
            } else {
              delete arrow.props.start.type;
            }

            // TODO: do we have any that are not binding?
            if (end.type === "binding") {
              const id = createBindingId();
              const binding: RelationBinding = {
                typeName: "binding",
                id,
                type: arrow.type,
                fromId: arrow.id,
                toId: end.boundShapeId,
                meta: {},
                props: {
                  terminal: "end",
                  normalizedAnchor: end.normalizedAnchor,
                  isExact: end.isExact || false,
                  isPrecise: end.isPrecise || false,
                },
              };

              oldStore[id] = binding;
            } else {
              delete arrow.props.end.type;
            }
          }
        },
      },
      {
        id: versions["2.3.0"],
        scope: "record",
        filter: (r: any) => {
          return isLegacyRelationOrReferencedShape({
            record: r,
            allRelationIds,
            allAddReferencedNodeActions,
            allNodeTypes,
          });
        },
        up: (arrow: any) => {
          arrow.props.start = { x: 0, y: 0 };
          arrow.props.end = { x: 0, y: 0 };
          arrow.props.labelPosition = 0.5;
          arrow.props.scale = 1;

          const color = getRelationColor(arrow.props.text || "");
          arrow.props.color = color;
          arrow.props.labelColor = color;
        },
      },
      {
        id: versions["AddSizeAndFontFamily"],
        scope: "record",
        filter: (r: any) => {
          const recordType = getRecordType(r);
          return (
            getRecordTypeName(r) === "shape" &&
            !!recordType &&
            allNodeTypes.includes(recordType)
          );
        },
        up: (shape: any) => {
          if (!shape.props.size) shape.props.size = "m";
          if (!shape.props.fontFamily) shape.props.fontFamily = "draw";
        },
      },
      {
        id: versions["RemoveNullAssetFileSize"],
        scope: "record",
        filter: (r: any) =>
          r.typeName === "asset" &&
          (r.type === "image" || r.type === "video") &&
          r.props?.fileSize === null,
        up: (asset: any) => {
          delete asset.props.fileSize;
        },
      },
      {
        id: versions["MigrateNodeTypeToDiscourseNode"],
        scope: "record",
        // Assumes node type ids and relation ids are distin
        filter: (r: any) => {
          const recordType = getRecordType(r);
          return (
            getRecordTypeName(r) === "shape" &&
            !!recordType &&
            allNodeTypes.includes(recordType)
          );
        },
        up: (shape: any) => {
          shape.props.nodeTypeId = shape.type;
          shape.type = DISCOURSE_NODE_SHAPE_TYPE;
        },
      },
      {
        id: versions["MigrateRelationTypeToDiscourseRelation"],
        scope: "store",
        up: (oldStore) => {
          migrateRelationTypesToDiscourseRelation({
            oldStore,
            allRelationIds,
            allAddReferencedNodeActions,
            allNodeTypes,
          });
        },
      },
    ],
  });
};
