import { describe, expect, it } from "vitest";
import { createTLSchema, defaultShapeSchemas } from "tldraw";
import {
  backfillTextShapeUrl,
  hasLinkUrlProp,
  isTextShapeRecord,
} from "~/utils/textShapeLink";

const makeTextShape = (
  props: Record<string, unknown> = {},
): {
  id: string;
  typeName: string;
  type: string;
  props: Record<string, unknown>;
} & Record<string, unknown> => ({
  id: "shape:t1",
  typeName: "shape",
  type: "text",
  x: 0,
  y: 0,
  rotation: 0,
  index: "a1",
  parentId: "page:page",
  isLocked: false,
  opacity: 1,
  meta: {},
  props: {
    color: "black",
    size: "m",
    font: "draw",
    textAlign: "middle",
    w: 100,
    text: "hello",
    scale: 1,
    autoSize: true,
    ...props,
  },
});

describe("isTextShapeRecord", () => {
  it("matches only text shape records", () => {
    expect(isTextShapeRecord(makeTextShape())).toBe(true);
    expect(isTextShapeRecord({ ...makeTextShape(), type: "geo" })).toBe(false);
    expect(isTextShapeRecord({ typeName: "asset", type: "text" })).toBe(false);
    expect(isTextShapeRecord(null)).toBe(false);
  });
});

describe("backfillTextShapeUrl", () => {
  it("adds an empty url to a shape created before link support", () => {
    const shape = makeTextShape();
    expect(hasLinkUrlProp(shape)).toBe(false);
    backfillTextShapeUrl(shape);
    expect(shape.props.url).toBe("");
  });

  it("makes the shape eligible for the Edit link action", () => {
    const shape = makeTextShape();
    backfillTextShapeUrl(shape);
    // tldraw's useHasLinkShapeSelected gates on this exact check
    expect(hasLinkUrlProp(shape)).toBe(true);
  });

  it("never overwrites a url the user already set", () => {
    const shape = makeTextShape({ url: "https://example.com" });
    backfillTextShapeUrl(shape);
    backfillTextShapeUrl(shape);
    expect(shape.props.url).toBe("https://example.com");
  });

  it("leaves non-text shapes untouched", () => {
    const geo = { ...makeTextShape(), type: "geo" };
    backfillTextShapeUrl(geo);
    expect(hasLinkUrlProp(geo)).toBe(false);
  });
});

describe("text shape url persistence", () => {
  const extendedSchema = createTLSchema({
    shapes: {
      ...defaultShapeSchemas,
      text: {
        ...defaultShapeSchemas.text,
        props: {
          ...defaultShapeSchemas.text.props,
          url: defaultShapeSchemas.geo.props.url,
        },
      },
    },
  });

  const validate = (shape: unknown) =>
    extendedSchema.validateRecord(
      {} as never,
      shape as never,
      "initialize",
      null,
    );

  it("rejects a pre-link text shape that was never migrated", () => {
    expect(() => validate(makeTextShape())).toThrow(/url/);
  });

  it("accepts a migrated text shape and round-trips the link", () => {
    const shape = makeTextShape();
    backfillTextShapeUrl(shape);
    expect(() => validate(shape)).not.toThrow();

    shape.props.url = "https://example.com";
    const migrated = extendedSchema.migrateStoreSnapshot({
      store: { [shape.id]: structuredClone(shape) } as never,
      schema: extendedSchema.serialize(),
    });
    expect(migrated.type).toBe("success");
    const migratedShape = (
      migrated as unknown as { value: Record<string, typeof shape> }
    ).value[shape.id];
    expect(migratedShape.props.url).toBe("https://example.com");
  });
});
