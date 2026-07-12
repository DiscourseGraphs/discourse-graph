import { describe, expect, it } from "vitest";
import {
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

  it("returns null for a non-dg-canvas embed or unrelated text", () => {
    expect(parseDgCanvasEmbed("{{dg-query: [[My Canvas]]}}")).toBeNull();
    expect(parseDgCanvasEmbed("just some text")).toBeNull();
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
