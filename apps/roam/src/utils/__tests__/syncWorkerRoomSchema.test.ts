import { describe, expect, it } from "vitest";
import { createTLSchema, defaultShapeSchemas } from "tldraw";
import { baseShapeUtils } from "~/components/canvas/baseShapeUtils";

// Mirrors apps/tldraw-sync-worker/worker/TldrawDurableObject.ts. The worker
// blanks declared shape types to {}, which is safe only for types the client
// also registers without migrations. Blanking a default type drops its
// migration sequence, so the room reports version 0 against the client's 2 and
// every client is rejected as too old.
const textUtil = baseShapeUtils.find(
  (util) => util.type === "text",
) as unknown as {
  props: never;
  migrations: never;
};

const clientSchema = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    text: { props: textUtil.props, migrations: textUtil.migrations },
    "discourse-node": {},
  } as never,
});

const textSequenceVersion = (schema: ReturnType<typeof createTLSchema>) =>
  (schema.serialize() as unknown as { sequences: Record<string, number> })
    .sequences["com.tldraw.shape.text"];

describe("sync worker room schema", () => {
  it("stays migration-compatible when text keeps its own migrations", () => {
    const workerSchema = createTLSchema({
      shapes: {
        ...defaultShapeSchemas,
        text: {
          ...defaultShapeSchemas.text,
          props: {
            ...defaultShapeSchemas.text.props,
            url: defaultShapeSchemas.geo.props.url,
          },
        },
        "discourse-node": {},
      } as never,
    });

    expect(textSequenceVersion(workerSchema)).toBe(
      textSequenceVersion(clientSchema),
    );
    expect(
      workerSchema.migrateStoreSnapshot({
        store: {} as never,
        schema: clientSchema.serialize(),
      }).type,
    ).toBe("success");
  });

  it("breaks if text is blanked to {} the way custom types are", () => {
    const brokenSchema = createTLSchema({
      shapes: { ...defaultShapeSchemas, text: {} } as never,
    });

    expect(textSequenceVersion(brokenSchema)).toBe(0);
    expect(
      brokenSchema.migrateStoreSnapshot({
        store: {} as never,
        schema: clientSchema.serialize(),
      }).type,
    ).toBe("error");
  });
});
