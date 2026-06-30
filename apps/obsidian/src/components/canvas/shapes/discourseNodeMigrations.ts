import { createMigrationSequence, createMigrationIds } from "tldraw";

const SEQUENCE_ID_BASE = "com.discourse-graph.obsidian.discourse-node";

const versions = createMigrationIds(`${SEQUENCE_ID_BASE}`, {
  addSizeAndFontFamily: 1,
});

type DiscourseNodeMigrationProps = {
  size?: string;
  fontFamily?: string;
};

type DiscourseNodeMigrationRecord = {
  typeName: string;
  type: string;
  props: DiscourseNodeMigrationProps;
};

const isDiscourseNodeMigrationRecord = (
  record: unknown,
): record is DiscourseNodeMigrationRecord => {
  if (typeof record !== "object" || record === null) {
    return false;
  }
  const candidate = record as Record<string, unknown>;
  const props = candidate.props;
  return (
    candidate.typeName === "shape" &&
    candidate.type === "discourse-node" &&
    typeof props === "object" &&
    props !== null
  );
};

export const discourseNodeMigrations = createMigrationSequence({
  sequenceId: `${SEQUENCE_ID_BASE}`,
  sequence: [
    {
      id: versions["addSizeAndFontFamily"],
      scope: "record",
      filter: (record) => isDiscourseNodeMigrationRecord(record),
      up: (shape) => {
        if (!isDiscourseNodeMigrationRecord(shape)) {
          return;
        }
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
