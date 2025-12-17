/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createMigrationSequence,
  createMigrationIds,
} from "tldraw";

const SEQUENCE_ID_BASE = "com.discourse-graph.obsidian.discourse-node";

const versions = createMigrationIds(`${SEQUENCE_ID_BASE}`, {
  addSizeAndFontFamily: 1,
});

export const discourseNodeMigrations = createMigrationSequence({
  sequenceId: `${SEQUENCE_ID_BASE}`,
  sequence: [
    {
      id: versions["addSizeAndFontFamily"],
      scope: "record",
      filter: (r: any) =>
        r.typeName === "shape" && r.type === "discourse-node",
      up: (shape: any) => {
        // Only add defaults if they don't already exist
        if (shape.props.size === undefined) {
          shape.props.size = "s";
        }
        if (shape.props.fontFamily === undefined) {
          shape.props.fontFamily = "draw";
        }
      },
    },
  ],
});

