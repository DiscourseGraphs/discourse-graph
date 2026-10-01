import { describe, expect, it } from "vitest";
import { createTLSchema, TLShape } from "tldraw";
import { getTextShapeLinkUrl } from "~/utils/textShapeLink";

const makeShape = ({
  type = "text",
  meta = {},
}: {
  type?: string;
  meta?: Record<string, unknown>;
} = {}): TLShape =>
  ({
    id: "shape:t1",
    typeName: "shape",
    type,
    x: 0,
    y: 0,
    rotation: 0,
    index: "a1",
    parentId: "page:page",
    isLocked: false,
    opacity: 1,
    meta,
    props: {
      color: "black",
      size: "m",
      font: "draw",
      textAlign: "middle",
      w: 100,
      text: "hello",
      scale: 1,
      autoSize: true,
    },
  }) as unknown as TLShape;

const withUrl = (url: unknown): TLShape => makeShape({ meta: { url } });

describe("getTextShapeLinkUrl", () => {
  it("returns the parsed href for a valid link", () => {
    expect(getTextShapeLinkUrl(withUrl("https://Example.com"))).toBe(
      "https://example.com/",
    );
    expect(getTextShapeLinkUrl(withUrl("mailto:a@b.co"))).toBe("mailto:a@b.co");
  });

  it("treats a missing or cleared link as no link", () => {
    expect(getTextShapeLinkUrl(makeShape())).toBeUndefined();
    expect(getTextShapeLinkUrl(withUrl(""))).toBeUndefined();
    expect(getTextShapeLinkUrl(withUrl(42))).toBeUndefined();
  });

  it("ignores links on shapes other than text", () => {
    const geo = makeShape({
      type: "geo",
      meta: { url: "https://example.com" },
    });
    expect(getTextShapeLinkUrl(geo)).toBeUndefined();
  });

  // meta has no schema, so a collaborator or API writer can store anything here.
  it("rejects protocols that could run script", () => {
    expect(getTextShapeLinkUrl(withUrl("javascript:alert(1)"))).toBeUndefined();
    expect(
      getTextShapeLinkUrl(withUrl(" javascript:alert(1)")),
    ).toBeUndefined();
    expect(getTextShapeLinkUrl(withUrl("data:text/html,x"))).toBeUndefined();
  });

  it("rejects relative URLs that linkUrl resolves against a dummy origin", () => {
    expect(getTextShapeLinkUrl(withUrl("/page"))).toBeUndefined();
    expect(getTextShapeLinkUrl(withUrl("//evil.example/x"))).toBeUndefined();
  });
});

describe("text shape link persistence", () => {
  // The stock schema is what older extension builds and the sync worker use.
  const stockSchema = createTLSchema();

  it("validates a text shape carrying meta.url against the stock schema", () => {
    expect(() =>
      stockSchema.validateRecord(
        {} as never,
        withUrl("https://example.com") as never,
        "initialize",
        null,
      ),
    ).not.toThrow();
  });

  it("round-trips meta.url through a snapshot load with no migration", () => {
    const shape = withUrl("https://example.com");
    const migrated = stockSchema.migrateStoreSnapshot({
      store: { [shape.id]: shape },
      schema: stockSchema.serialize(),
    });
    expect(migrated.type).toBe("success");
    const loaded = (migrated as unknown as { value: Record<string, TLShape> })
      .value[shape.id];
    expect(loaded.meta.url).toBe("https://example.com");
  });
});
