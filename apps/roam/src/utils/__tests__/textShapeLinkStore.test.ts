import { describe, expect, it } from "vitest";
import { createTLSchema, defaultShapeSchemas, TextShapeUtil } from "tldraw";
import { baseShapeUtils } from "~/components/canvas/baseShapeUtils";
import { TextShapeWithLinkUtil } from "~/components/canvas/TextShapeWithLinkUtil";

// Built the way createTLStore derives a schema from its utils, so this exercises
// the real util rather than a hand-rolled copy of its props.
const textUtil = baseShapeUtils.find((util) => util.type === "text");

const schemaFromUtils = createTLSchema({
  shapes: {
    ...defaultShapeSchemas,
    text: {
      props: (textUtil as unknown as { props: never }).props,
      migrations: (textUtil as unknown as { migrations: never }).migrations,
    },
  },
});

const makeTextShape = (url?: string) => ({
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
    ...(url === undefined ? {} : { url }),
  },
});

describe("baseShapeUtils", () => {
  it("replaces the stock text util exactly once", () => {
    expect(textUtil).toBe(TextShapeWithLinkUtil);
    expect(baseShapeUtils).not.toContain(TextShapeUtil);
    expect(baseShapeUtils.filter((u) => u.type === "text")).toHaveLength(1);
  });

  it("keeps every other default util", () => {
    expect(baseShapeUtils).toHaveLength(12);
  });
});

describe("schema derived from the real util", () => {
  const validate = (shape: unknown) =>
    schemaFromUtils.validateRecord(
      {} as never,
      shape as never,
      "initialize",
      null,
    );

  it("accepts a text shape carrying a link", () => {
    expect(() => validate(makeTextShape("https://example.com"))).not.toThrow();
  });

  it("accepts an empty url, the value the migration backfills", () => {
    expect(() => validate(makeTextShape(""))).not.toThrow();
  });

  it("rejects a text shape that never got the url prop", () => {
    expect(() => validate(makeTextShape())).toThrow(/url/);
  });

  it("rejects a non-http url", () => {
    expect(() => validate(makeTextShape("javascript:alert(1)"))).toThrow(/url/);
  });

  it("gives new text shapes a url so they are link-eligible", () => {
    const defaults = new TextShapeWithLinkUtil(
      {} as never,
    ).getDefaultProps() as { url: string };
    expect("url" in defaults).toBe(true);
    expect(defaults.url).toBe("");
  });
});
