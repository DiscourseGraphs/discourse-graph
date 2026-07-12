import { describe, expect, it } from "vitest";
import {
  getFrameEmbedMode,
  parseDgCanvasEmbed,
  serializeDgCanvasEmbed,
} from "~/utils/dgCanvasEmbed";

describe("parseDgCanvasEmbed", () => {
  it("parses a whole-canvas embed (no frame argument)", () => {
    expect(parseDgCanvasEmbed("{{dg-canvas: [[My Canvas]]}}")).toEqual({
      title: "My Canvas",
    });
  });

  it("parses a name-only frame argument", () => {
    expect(
      parseDgCanvasEmbed('{{dg-canvas: [[My Canvas]] "Frame A"}}'),
    ).toEqual({
      title: "My Canvas",
      frameName: "Frame A",
    });
  });

  it("parses a name + shape-id frame argument", () => {
    expect(
      parseDgCanvasEmbed(
        '{{dg-canvas: [[My Canvas]] "Frame A" shape:aB1_c-2}}',
      ),
    ).toEqual({
      title: "My Canvas",
      frameName: "Frame A",
      frameShapeId: "shape:aB1_c-2",
    });
  });

  it("parses an id-only frame argument (name omitted)", () => {
    expect(
      parseDgCanvasEmbed("{{dg-canvas: [[My Canvas]] shape:aB1_c-2}}"),
    ).toEqual({
      title: "My Canvas",
      frameShapeId: "shape:aB1_c-2",
    });
  });

  it("is case-insensitive on the keyword and tolerates surrounding text", () => {
    expect(
      parseDgCanvasEmbed('prefix {{DG-Canvas: [[My Canvas]] "F"}} suffix'),
    ).toMatchObject({ title: "My Canvas", frameName: "F" });
  });

  // Degradation contract: a tail that is not a clean `"name"`/`shape:id`
  // argument is ignored, so the block still resolves to a whole-canvas embed
  // instead of failing to render.
  it("ignores a malformed frame argument and degrades to whole canvas", () => {
    expect(
      parseDgCanvasEmbed("{{dg-canvas: [[My Canvas]] not a frame arg}}"),
    ).toEqual({ title: "My Canvas" });
    expect(
      parseDgCanvasEmbed('{{dg-canvas: [[My Canvas]] "unclosed}}'),
    ).toEqual({ title: "My Canvas" });
    expect(
      parseDgCanvasEmbed('{{dg-canvas: [[My Canvas]] "Frame A" extra junk}}'),
    ).toEqual({ title: "My Canvas" });
  });

  it("tolerates extra whitespace around a valid frame argument", () => {
    expect(
      parseDgCanvasEmbed('{{dg-canvas: [[My Canvas]]   "Frame A"   }}'),
    ).toEqual({ title: "My Canvas", frameName: "Frame A" });
  });

  // A lone `}` inside a frame name must not stop the match at the wrong place and
  // blank the whole block — the embed still parses (title + id survive) rather
  // than returning null.
  it("keeps a `}` inside a frame name from blanking the embed", () => {
    expect(
      parseDgCanvasEmbed('{{dg-canvas: [[My Canvas]] "Fig }2" shape:aB1_c-2}}'),
    ).toEqual({
      title: "My Canvas",
      frameName: "Fig }2",
      frameShapeId: "shape:aB1_c-2",
    });
  });

  it("returns null for a non-dg-canvas embed or unrelated text", () => {
    expect(parseDgCanvasEmbed("{{dg-query: [[My Canvas]]}}")).toBeNull();
    expect(parseDgCanvasEmbed("just some text")).toBeNull();
  });

  it("parses the trailing `live` modifier in every frame-argument shape", () => {
    expect(
      parseDgCanvasEmbed(
        '{{dg-canvas: [[My Canvas]] "Frame A" shape:aB1_c-2 live}}',
      ),
    ).toEqual({
      title: "My Canvas",
      frameName: "Frame A",
      frameShapeId: "shape:aB1_c-2",
      live: true,
    });
    expect(
      parseDgCanvasEmbed("{{dg-canvas: [[My Canvas]] shape:aB1_c-2 live}}"),
    ).toEqual({
      title: "My Canvas",
      frameShapeId: "shape:aB1_c-2",
      live: true,
    });
    expect(
      parseDgCanvasEmbed('{{dg-canvas: [[My Canvas]] "Frame A" live}}'),
    ).toEqual({
      title: "My Canvas",
      frameName: "Frame A",
      live: true,
    });
  });

  it("parses a bare `live` with no frame argument (frameless embeds are live anyway)", () => {
    expect(parseDgCanvasEmbed("{{dg-canvas: [[My Canvas]] live}}")).toEqual({
      title: "My Canvas",
      live: true,
    });
  });

  // `live` is canonical: lowercase, always last. Anything else falls under the
  // existing degradation contract (frame args ignored, whole-canvas embed).
  it("degrades when `live` is misplaced, cased differently, or followed by junk", () => {
    expect(
      parseDgCanvasEmbed("{{dg-canvas: [[My Canvas]] live shape:aB1_c-2}}"),
    ).toEqual({ title: "My Canvas" });
    expect(
      parseDgCanvasEmbed('{{dg-canvas: [[My Canvas]] "Frame A" Live}}'),
    ).toEqual({ title: "My Canvas" });
    expect(
      parseDgCanvasEmbed('{{dg-canvas: [[My Canvas]] "Frame A" live junk}}'),
    ).toEqual({ title: "My Canvas" });
  });
});

describe("getFrameEmbedMode", () => {
  it("defaults to snapshot for local-mode canvases", () => {
    expect(getFrameEmbedMode({ canvasSyncMode: "local" })).toBe("snapshot");
  });

  it("honors an explicit live request regardless of sync mode", () => {
    expect(getFrameEmbedMode({ live: true, canvasSyncMode: "local" })).toBe(
      "live",
    );
    expect(getFrameEmbedMode({ live: true, canvasSyncMode: "sync" })).toBe(
      "live",
    );
  });

  it("falls back to a labeled live embed for sync-mode canvases", () => {
    expect(getFrameEmbedMode({ canvasSyncMode: "sync" })).toBe(
      "live-sync-fallback",
    );
  });
});

describe("serializeDgCanvasEmbed", () => {
  it("round-trips a whole-canvas embed", () => {
    const text = serializeDgCanvasEmbed({ title: "My Canvas" });
    expect(text).toBe("{{dg-canvas: [[My Canvas]]}}");
    expect(parseDgCanvasEmbed(text)).toEqual({ title: "My Canvas" });
  });

  it("round-trips a fully-specified frame embed", () => {
    const embed = {
      title: "My Canvas",
      frameName: "Frame A",
      frameShapeId: "shape:aB1_c-2",
    };
    const text = serializeDgCanvasEmbed(embed);
    expect(text).toBe('{{dg-canvas: [[My Canvas]] "Frame A" shape:aB1_c-2}}');
    expect(parseDgCanvasEmbed(text)).toEqual(embed);
  });

  it("round-trips the live modifier", () => {
    const embed = {
      title: "My Canvas",
      frameName: "Frame A",
      frameShapeId: "shape:aB1_c-2",
      live: true,
    };
    const text = serializeDgCanvasEmbed(embed);
    expect(text).toBe(
      '{{dg-canvas: [[My Canvas]] "Frame A" shape:aB1_c-2 live}}',
    );
    expect(parseDgCanvasEmbed(text)).toEqual(embed);
  });

  it("strips curly braces from the frame name so the serialized token round-trips", () => {
    const text = serializeDgCanvasEmbed({
      title: "My Canvas",
      frameName: "Draft }v2{",
      frameShapeId: "shape:x",
    });
    // Braces gone; the token parses back to a whole, non-null embed.
    expect(text).toBe('{{dg-canvas: [[My Canvas]] "Draft v2" shape:x}}');
    expect(parseDgCanvasEmbed(text)).toEqual({
      title: "My Canvas",
      frameName: "Draft v2",
      frameShapeId: "shape:x",
    });
  });

  it("collapses embedded double-quotes in the frame name so the token stays parseable", () => {
    const text = serializeDgCanvasEmbed({
      title: "My Canvas",
      frameName: 'A "quoted" name',
      frameShapeId: "shape:x",
    });
    expect(text).toBe(
      "{{dg-canvas: [[My Canvas]] \"A 'quoted' name\" shape:x}}",
    );
    expect(parseDgCanvasEmbed(text)).toMatchObject({
      title: "My Canvas",
      frameShapeId: "shape:x",
    });
  });
});
