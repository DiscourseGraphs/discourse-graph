import { describe, expect, it } from "vitest";
import {
  assertCanCreateSubpage,
  buildPreviewModel,
  buildPrefixMatchers,
  getBoxLabel,
  getNestedPageMeta,
  layoutPreview,
  walkLineage,
  type PreviewShapeDescriptor,
} from "~/utils/nestedPages";

const geo = (
  overrides: Partial<PreviewShapeDescriptor> = {},
): PreviewShapeDescriptor => ({
  id: "shape:a",
  type: "geo",
  bounds: { x: 0, y: 0, w: 100, h: 50 },
  ...overrides,
});

describe("buildPrefixMatchers", () => {
  const nodes = [
    { type: "que-node", format: "[[QUE]] - {content}" },
    { type: "evd-node", format: "[[EVD]] - {content} - {Source}" },
    { type: "page-node", format: "{content}" },
    { type: "blck-node", format: "{content}" },
  ];

  it("derives a prefix from the text before the first placeholder", () => {
    const matchers = buildPrefixMatchers(nodes);
    expect(matchers.map((m) => m.prefix)).toEqual(["QUE", "EVD"]);
    expect(matchers.map((m) => m.nodeType)).toEqual(["que-node", "evd-node"]);
  });

  it("yields no matcher for formats that start with the placeholder", () => {
    const matchers = buildPrefixMatchers(nodes);
    expect(matchers.some((m) => m.nodeType === "page-node")).toBe(false);
    expect(matchers.some((m) => m.nodeType === "blck-node")).toBe(false);
  });

  it("matches prefixed labels case-insensitively across separators and newlines", () => {
    const matchers = buildPrefixMatchers(nodes);
    const match = (text: string) =>
      matchers.find((m) => m.regex.test(text))?.nodeType;
    expect(match("QUE - How fast does actin polymerize?")).toBe("que-node");
    expect(match("que: lowercase works")).toBe("que-node");
    expect(match("EVD\nobserved X in Y")).toBe("evd-node");
    expect(match("QUESTIONS are not a prefix")).toBeUndefined();
    expect(match("unprefixed text")).toBeUndefined();
  });

  it("strips the matched prefix from the remaining title", () => {
    const matchers = buildPrefixMatchers(nodes);
    const m = matchers.find((x) => x.nodeType === "que-node");
    expect("QUE - How fast?".replace(m!.regex, "")).toBe("How fast?");
  });

  it("matches and strips bracketed prefixes as Roam titles literally contain them", () => {
    const matchers = buildPrefixMatchers(nodes);
    const m = matchers.find((x) => x.regex.test("[[EVD]] - observed X"));
    expect(m?.nodeType).toBe("evd-node");
    expect("[[EVD]] - observed X".replace(m!.regex, "")).toBe("observed X");
  });
});

describe("walkLineage", () => {
  type Page = { id: string; name: string; parentPageId?: string };
  const lookup =
    (pages: Page[]) =>
    (id: string): Page | undefined =>
      pages.find((p) => p.id === id);

  it("returns the chain root-first including the current page", () => {
    const pages = [
      { id: "root", name: "Root" },
      { id: "mid", name: "Mid", parentPageId: "root" },
      { id: "leaf", name: "Leaf", parentPageId: "mid" },
    ];
    expect(walkLineage(lookup(pages), "leaf")).toEqual([
      { id: "root", name: "Root" },
      { id: "mid", name: "Mid" },
      { id: "leaf", name: "Leaf" },
    ]);
  });

  it("returns a single entry for a root page", () => {
    expect(walkLineage(lookup([{ id: "root", name: "Root" }]), "root")).toEqual(
      [{ id: "root", name: "Root" }],
    );
  });

  it("survives a parentPageId cycle", () => {
    const pages = [
      { id: "a", name: "A", parentPageId: "b" },
      { id: "b", name: "B", parentPageId: "a" },
    ];
    const chain = walkLineage(lookup(pages), "a");
    expect(chain.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("caps the walk at 16 pages", () => {
    const pages = Array.from({ length: 40 }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      parentPageId: i < 39 ? `p${i + 1}` : undefined,
    }));
    expect(walkLineage(lookup(pages), "p0")).toHaveLength(16);
  });

  it("stops when a parent page is missing", () => {
    const pages = [{ id: "leaf", name: "Leaf", parentPageId: "gone" }];
    expect(walkLineage(lookup(pages), "leaf")).toEqual([
      { id: "leaf", name: "Leaf" },
    ]);
  });
});

describe("getNestedPageMeta", () => {
  it("reads dgNested from page meta", () => {
    expect(
      getNestedPageMeta({
        dgNested: { parentPageId: "page:x", ownerShapeId: "shape:y" },
      }),
    ).toEqual({ parentPageId: "page:x", ownerShapeId: "shape:y" });
  });

  it("returns null for absent or malformed meta", () => {
    expect(getNestedPageMeta(undefined)).toBeNull();
    expect(getNestedPageMeta({})).toBeNull();
    expect(getNestedPageMeta({ dgNested: { parentPageId: 7 } })).toBeNull();
  });
});

describe("buildPreviewModel", () => {
  const matchers = buildPrefixMatchers([
    { type: "que-node", format: "[[QUE]] - {content}" },
  ]);

  it("returns an empty model for no shapes", () => {
    const model = buildPreviewModel([], matchers);
    expect(model).toEqual({ count: 0, boxes: [], bounds: null });
  });

  it("classifies discourse-node shapes as nodes with their type id", () => {
    const model = buildPreviewModel(
      [
        geo({
          type: "discourse-node",
          nodeTypeId: "que-node",
          text: "How fast?",
          imageUrl: "http://img",
        }),
      ],
      matchers,
    );
    expect(model.boxes[0]).toMatchObject({
      kind: "node",
      nodeType: "que-node",
      title: "How fast?",
      img: "http://img",
    });
  });

  it("strips the format prefix from discourse-node titles too", () => {
    const evdMatchers = buildPrefixMatchers([
      { type: "evd-node", format: "[[EVD]] - {content}" },
    ]);
    const model = buildPreviewModel(
      [
        geo({
          type: "discourse-node",
          nodeTypeId: "evd-node",
          text: "[[EVD]] - Cortactin assembled with Arp3",
        }),
      ],
      evdMatchers,
    );
    expect(model.boxes[0]).toMatchObject({
      kind: "node",
      nodeType: "evd-node",
      title: "Cortactin assembled with Arp3",
    });
  });

  it("classifies grammar-prefixed labels as nodes of the matched type", () => {
    const model = buildPreviewModel(
      [geo({ text: "QUE - How fast does actin polymerize?" })],
      matchers,
    );
    expect(model.boxes[0]).toMatchObject({
      kind: "node",
      nodeType: "que-node",
      title: "How fast does actin polymerize?",
    });
  });

  it("classifies frames, images, portals, text, and plain geo", () => {
    const model = buildPreviewModel(
      [
        geo({ id: "s1", type: "frame", frameName: "Study A" }),
        geo({ id: "s2", type: "image", imageUrl: "http://img" }),
        geo({
          id: "s3",
          type: "dg-subpage",
          portalTitle: "Inner",
          portalAccent: "#123456",
        }),
        geo({ id: "s4", type: "text", text: "a caption" }),
        geo({ id: "s5", text: "plain card", colorStyle: "yellow" }),
      ],
      matchers,
    );
    expect(model.boxes.map((b) => b.kind).sort()).toEqual([
      "frame",
      "geo",
      "image",
      "portal",
      "text",
    ]);
    const portal = model.boxes.find((b) => b.kind === "portal");
    expect(portal).toMatchObject({ title: "Inner", color: "#123456" });
  });

  it("skips arrows, groups, and zero-extent shapes; count equals boxes drawn", () => {
    const model = buildPreviewModel(
      [
        geo({ id: "s1" }),
        geo({ id: "s2", type: "arrow" }),
        geo({ id: "s3", type: "group" }),
        geo({ id: "s4", bounds: { x: 10, y: 10, w: 0, h: 40 } }),
        geo({ id: "s5", bounds: null }),
      ],
      matchers,
    );
    expect(model.count).toBe(1);
    expect(model.count).toBe(model.boxes.length);
  });

  it("computes union bounds and stacks frames below nodes below images", () => {
    const model = buildPreviewModel(
      [
        geo({
          id: "s1",
          type: "image",
          bounds: { x: 200, y: 200, w: 100, h: 100 },
        }),
        geo({
          id: "s2",
          type: "discourse-node",
          nodeTypeId: "que-node",
          text: "t",
          bounds: { x: 50, y: 60, w: 100, h: 40 },
        }),
        geo({
          id: "s3",
          type: "frame",
          frameName: "F",
          bounds: { x: 0, y: 0, w: 400, h: 300 },
        }),
      ],
      matchers,
    );
    expect(model.bounds).toEqual({ minX: 0, minY: 0, maxX: 400, maxY: 300 });
    expect(model.boxes.map((b) => b.kind)).toEqual(["frame", "node", "image"]);
  });
});

describe("layoutPreview", () => {
  it("scale-to-fits the page bounds into the body, centered", () => {
    const layout = layoutPreview({
      shape: { w: 460, h: 340 },
      hasSubtitle: false,
      bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 500 },
    });
    expect(layout.area).toEqual({ x: 8, y: 48, w: 444, h: 284 });
    expect(layout.scale).toBeCloseTo(0.444);
    expect(layout.offX).toBeCloseTo(8);
    expect(layout.offY).toBeCloseTo(48 + (284 - 500 * 0.444) / 2);
  });

  it("reserves a strip for the subtitle", () => {
    const layout = layoutPreview({
      shape: { w: 460, h: 340 },
      hasSubtitle: true,
      bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
    });
    expect(layout.area.y).toBe(48 + 18);
  });
});

describe("getBoxLabel", () => {
  it("shows the full title when the scaled box is large enough", () => {
    const label = getBoxLabel(
      { kind: "node", title: "How fast?", code: "QUE" },
      120,
      40,
    );
    expect(label).toMatchObject({ mode: "title", text: "QUE  How fast?" });
  });

  it("falls back to the type code in small boxes", () => {
    const label = getBoxLabel(
      { kind: "node", title: "How fast?", code: "QUE" },
      30,
      12,
    );
    expect(label).toMatchObject({ mode: "code", text: "QUE" });
  });

  it("shows nothing when the box is tiny", () => {
    expect(
      getBoxLabel({ kind: "node", title: "t", code: "QUE" }, 10, 6),
    ).toBeNull();
  });

  it("labels bare text whenever it fits horizontally", () => {
    const label = getBoxLabel({ kind: "text", title: "a caption" }, 60, 10);
    expect(label).toMatchObject({ mode: "text", text: "a caption" });
  });

  it("caps long titles at 90 characters with an ellipsis", () => {
    const label = getBoxLabel(
      { kind: "node", title: "x".repeat(200), code: "EVD" },
      200,
      100,
    );
    expect(label?.text).toHaveLength(90);
    expect(label?.text.endsWith("…")).toBe(true);
  });

  it("clamps the label to 2 lines when the box has an image, so the image stays visible", () => {
    const withImage = getBoxLabel(
      { kind: "node", title: "long title ".repeat(8), code: "EVD", img: "u" },
      200,
      200,
    );
    expect(withImage?.maxLines).toBe(2);
    const withoutImage = getBoxLabel(
      { kind: "node", title: "long title ".repeat(8), code: "EVD" },
      200,
      200,
    );
    expect(withoutImage?.maxLines).toBeGreaterThan(2);
  });
});

describe("assertCanCreateSubpage", () => {
  it("passes below the page cap", () => {
    expect(() =>
      assertCanCreateSubpage({ pageCount: 3, maxPages: 40 }),
    ).not.toThrow();
  });

  it("throws a loud error at the cap instead of stranding an orphan portal", () => {
    expect(() =>
      assertCanCreateSubpage({ pageCount: 40, maxPages: 40 }),
    ).toThrow(/40/);
  });
});
