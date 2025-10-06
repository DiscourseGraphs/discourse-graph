/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/naming-convention */

import {
  createMigrationSequence,
  createBindingId,
  TLShapeId,
  VecModel,
  TLBaseShape,
} from "tldraw";
import { createMigrationIds } from "tldraw";
import { RelationBinding } from "./DiscourseRelationBindings";
import { getRelationColor } from "./DiscourseRelationUtil";

const SEQUENCE_ID_BASE = "com.roam-research.discourse-graphs";

export const createMigrations = ({
  allRelationIds,
  allAddReferencedNodeActions,
  allNodeTypes,
}: {
  allRelationIds: string[];
  allAddReferencedNodeActions: string[];
  allNodeTypes: string[];
}) => {
  const allRelationShapeIds = [
    ...allRelationIds,
    ...allAddReferencedNodeActions,
  ];
  const versions = createMigrationIds(`${SEQUENCE_ID_BASE}`, {
    ExtractBindings: 1,
    "2.3.0": 2,
    AddSizeAndFontFamily: 3,
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

          const arrows = Object.values(oldStore).filter(
            (r: any): r is OldArrow =>
              r.typeName === "shape" &&
              "type" in r &&
              allRelationShapeIds.includes(r.type),
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
                fromId: arrow.id,
                toId: start.boundShapeId,
                meta: {},
                props: {
                  terminal: "start",
                  normalizedAnchor: start.normalizedAnchor,
                  isExact: start.isExact || false,
                  isPrecise: start.isPrecise || false,
                  snap: "none",
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
                  snap: "none",
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
          return r.typeName === "shape" && allRelationShapeIds.includes(r.type);
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
        filter: (r: any) =>
          r.typeName === "shape" && allNodeTypes.includes(r.type),
        up: (shape: any) => {
          shape.props.size = "m";
          shape.props.fontFamily = "draw";
        },
      },
    ],
  });
};
