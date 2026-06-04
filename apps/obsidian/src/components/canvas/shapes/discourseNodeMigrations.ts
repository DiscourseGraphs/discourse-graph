/* eslint-disable @typescript-eslint/no-unsafe-member-access -- tldraw migration callbacks receive untyped records */
import { createMigrationSequence, createMigrationIds } from "tldraw";

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tldraw migration filter uses legacy shape records
      filter: (r: any) => r.typeName === "shape" && r.type === "discourse-node",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tldraw migration up uses legacy shape records
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
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
