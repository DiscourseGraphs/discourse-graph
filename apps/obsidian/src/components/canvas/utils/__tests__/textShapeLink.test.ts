import { describe, expect, it } from "vitest";
import { createTLSchema, defaultShapeSchemas } from "tldraw";
import {
  backfillTextShapeUrl,
  hasLinkUrlProp,
  isAllowedTextLinkUrl,
  isTextShapeRecord,
  textLinkUrl,
} from "~/components/canvas/utils/textShapeLink";

const OBSIDIAN_URL = "obsidian://open?vault=MyVault&file=Notes%2FPage.md";

const makeTextShape = (
  props: Record<string, unknown> = {},
): Record<string, unknown> & { props: Record<string, unknown> } => ({
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
    textAlign: "start",
    w: 100,
    richText: { type: "doc", content: [] },
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

describe("textLinkUrl", () => {
  it("accepts web, mailto and obsidian links", () => {
    for (const url of [
      "",
      "https://example.com",
      "http://example.com/a?b=c",
      "mailto:someone@example.com",
      OBSIDIAN_URL,
    ]) {
      expect(isAllowedTextLinkUrl(url)).toBe(true);
      expect(() => textLinkUrl.validate(url)).not.toThrow();
    }
  });

  it("rejects protocols that are not on the allowlist", () => {
    // The link renders as <a href>, so javascript: would be an XSS vector.
    for (const url of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "data:text/html,<script>",
      "not a url",
    ]) {
      expect(isAllowedTextLinkUrl(url)).toBe(false);
      expect(() => textLinkUrl.validate(url)).toThrow();
    }
  });

  it("accepts an obsidian link that tldraw's own validator rejects", () => {
    expect(() =>
      defaultShapeSchemas.geo.props.url.validate(OBSIDIAN_URL),
    ).toThrow();
    expect(() => textLinkUrl.validate(OBSIDIAN_URL)).not.toThrow();
  });
});

describe("text shape url persistence", () => {
  const extendedSchema = createTLSchema({
    shapes: {
      ...defaultShapeSchemas,
      text: {
        ...defaultShapeSchemas.text,
        props: { ...defaultShapeSchemas.text.props, url: textLinkUrl },
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
    // The real failure mode: TldrawView swallows this and renders a blank canvas.
    expect(() => validate(makeTextShape())).toThrow(/url/);
  });

  it("accepts a migrated text shape and round-trips the link", () => {
    const shape = makeTextShape();
    backfillTextShapeUrl(shape);
    expect(() => validate(shape)).not.toThrow();

    shape.props.url = OBSIDIAN_URL;
    const migrated = extendedSchema.migrateStoreSnapshot({
      store: { [shape.id as string]: structuredClone(shape) } as never,
      schema: extendedSchema.serialize(),
    });
    expect(migrated.type).toBe("success");
    const migratedShape = (
      migrated as unknown as { value: Record<string, typeof shape> }
    ).value[shape.id as string];
    expect(migratedShape?.props.url).toBe(OBSIDIAN_URL);
  });
});
