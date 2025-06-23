import {
  createMigrationSequence,
  createBindingId,
  TLShapeId,
  VecModel,
  TLBaseShape,
} from "tldraw";
import { createMigrationIds } from "tldraw";
import { RelationBinding } from "./DiscourseRelationBindings";

const SEQUENCE_ID_BASE = "com.roam-research.query-builder";

export const createArrowShapeMigrations = ({
  allRelationIds,
  allAddReferencedNodeActions,
}: {
  allRelationIds: string[];
  allAddReferencedNodeActions: string[];
}) => {
  const allShapeIds = [...allRelationIds, ...allAddReferencedNodeActions];
  return allShapeIds.map((shapeId) => {
    const versions = createMigrationIds(`${SEQUENCE_ID_BASE}.${shapeId}`, {
      "2.3.0": 1,
      ExtractBindings: 2,
    });
    return createMigrationSequence({
      sequenceId: `${SEQUENCE_ID_BASE}.${shapeId}`,
      sequence: [
        {
          id: versions["2.3.0"],
          scope: "record",
          filter: (r: any) => r.type === shapeId && r.typeName === "shape",
          up: (arrow: any) => {
            arrow.props.start = { x: 0, y: 0 };
            arrow.props.end = { x: 0, y: 0 };
            arrow.props.labelPosition = 0.5;
            arrow.props.scale = 1;

            // TODO: migrate colors
            arrow.props.color = "black";
          },
        },
        {
          id: versions["ExtractBindings"],
          scope: "store",
          up(oldStore) {
            type OldArrowTerminal =
              | {
                  type: "point";
                  x: number;
                  y: number;
                }
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

            const arrows = Object.values(oldStore).filter(
              (r: any): r is OldArrow =>
                r.typeName === "shape" &&
                "type" in r &&
                (allRelationIds.includes(r.type) ||
                  allAddReferencedNodeActions.includes(r.type))
            );

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
                  fromId: arrow.id as TLShapeId,
                  toId: start.boundShapeId as TLShapeId,
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
                  fromId: arrow.id as TLShapeId,
                  toId: end.boundShapeId as TLShapeId,
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
      ],
    });
  });
};
