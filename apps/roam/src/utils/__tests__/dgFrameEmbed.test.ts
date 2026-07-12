import { describe, expect, it } from "vitest";
import { parseDgFrameEmbed, serializeDgFrameEmbed } from "~/utils/dgFrameEmbed";

describe("parseDgFrameEmbed", () => {
  it("parses a frameless embed", () => {
    expect(parseDgFrameEmbed("{{dg-frame: [[My Canvas]]}}")).toEqual({
      title: "My Canvas",
    });
  });

  it("parses a name-only embed", () => {
    expect(parseDgFrameEmbed('{{dg-frame: [[My Canvas]] "Frame A"}}')).toEqual({
      title: "My Canvas",
      frameName: "Frame A",
    });
  });

  it("parses a name + shape-id embed", () => {
    expect(
      parseDgFrameEmbed('{{dg-frame: [[My Canvas]] "Frame A" shape:aB1_c-2}}'),
    ).toEqual({
      title: "My Canvas",
      frameName: "Frame A",
      frameShapeId: "shape:aB1_c-2",
    });
  });

  it("parses an id-only embed (name omitted)", () => {
    expect(
      parseDgFrameEmbed("{{dg-frame: [[My Canvas]] shape:aB1_c-2}}"),
    ).toEqual({
      title: "My Canvas",
      frameShapeId: "shape:aB1_c-2",
    });
  });

  it("is case-insensitive on the keyword and tolerates surrounding text", () => {
    expect(
      parseDgFrameEmbed('prefix {{DG-Frame: [[My Canvas]] "F"}} suffix'),
    ).toMatchObject({ title: "My Canvas", frameName: "F" });
  });

  it("returns null for a dg-canvas embed or unrelated text", () => {
    expect(parseDgFrameEmbed("{{dg-canvas: [[My Canvas]]}}")).toBeNull();
    expect(parseDgFrameEmbed("just some text")).toBeNull();
  });
});

describe("serializeDgFrameEmbed", () => {
  it("round-trips a frameless embed", () => {
    const text = serializeDgFrameEmbed({ title: "My Canvas" });
    expect(text).toBe("{{dg-frame: [[My Canvas]]}}");
    expect(parseDgFrameEmbed(text)).toEqual({ title: "My Canvas" });
  });

  it("round-trips a fully-specified embed", () => {
    const embed = {
      title: "My Canvas",
      frameName: "Frame A",
      frameShapeId: "shape:aB1_c-2",
    };
    const text = serializeDgFrameEmbed(embed);
    expect(text).toBe('{{dg-frame: [[My Canvas]] "Frame A" shape:aB1_c-2}}');
    expect(parseDgFrameEmbed(text)).toEqual(embed);
  });

  it("collapses embedded double-quotes in the frame name so the token stays parseable", () => {
    const text = serializeDgFrameEmbed({
      title: "My Canvas",
      frameName: 'A "quoted" name',
      frameShapeId: "shape:x",
    });
    expect(text).toBe(
      "{{dg-frame: [[My Canvas]] \"A 'quoted' name\" shape:x}}",
    );
    expect(parseDgFrameEmbed(text)).toMatchObject({
      title: "My Canvas",
      frameShapeId: "shape:x",
    });
  });
});
