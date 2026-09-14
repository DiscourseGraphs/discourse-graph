import { createMigrationSequence, createMigrationIds } from "tldraw";
import {
  backfillTextShapeUrl,
  isTextShapeRecord,
} from "~/components/canvas/utils/textShapeLink";

const SEQUENCE_ID_BASE = "com.discourse-graph.obsidian.text-link";

const versions = createMigrationIds(`${SEQUENCE_ID_BASE}`, {
  addTextShapeUrl: 1,
});

type TextLinkMigrationRecord = {
  props: Record<string, unknown>;
};

// Without this backfill a pre-existing text shape has no `url` key, which both
// fails validation on load and leaves the shape ineligible for Edit link.
// `retroactive` defaults to true, which is what reaches files predating it.
export const textLinkMigrations = createMigrationSequence({
  sequenceId: `${SEQUENCE_ID_BASE}`,
  sequence: [
    {
      id: versions["addTextShapeUrl"],
      scope: "record",
      filter: (record) => isTextShapeRecord(record),
      up: (record) => {
        backfillTextShapeUrl(record);
      },
      down: (record) => {
        delete (record as unknown as TextLinkMigrationRecord).props.url;
      },
    },
  ],
});
