import { describe, expect, it } from "vitest";
import falsePositiveFixtures from "./fixtures/legacyCanvasFalsePositiveRecords.json";
import fixtures from "./fixtures/legacyCanvasNodeRecords.json";
import {
  getLegacyCanvasNodeRecords,
  isLegacyCanvasNodeCandidate,
  isLegacyCanvasNodeRecord,
} from "~/utils/legacyCanvasNodeDetector";

describe("legacy canvas node detector", () => {
  it("matches sanitized representative legacy node records", () => {
    expect(fixtures.every(isLegacyCanvasNodeRecord)).toBe(true);
    expect(getLegacyCanvasNodeRecords(fixtures)).toEqual(fixtures);
  });

  it("rejects relation-shaped candidates without node box dimensions", () => {
    expect(falsePositiveFixtures.every(isLegacyCanvasNodeCandidate)).toBe(true);
    expect(falsePositiveFixtures.every(isLegacyCanvasNodeRecord)).toBe(false);
  });

  it.each([
    ["non-shape record", { ...fixtures[0], typeName: "asset" }],
    ["long shape type", { ...fixtures[0], type: "discourse-node" }],
    ["short shape type", { ...fixtures[0], type: "SHORTUID" }],
    ["missing props", { ...fixtures[0], props: undefined }],
    [
      "long node uid",
      { ...fixtures[0], props: { ...fixtures[0].props, uid: "TOO-LONG-UID" } },
    ],
    [
      "invalid node uid character",
      { ...fixtures[0], props: { ...fixtures[0].props, uid: "NODE.UID1" } },
    ],
    [
      "missing width",
      { ...fixtures[0], props: { ...fixtures[0].props, w: undefined } },
    ],
    [
      "non-positive height",
      { ...fixtures[0], props: { ...fixtures[0].props, h: 0 } },
    ],
    [
      "non-finite width",
      { ...fixtures[0], props: { ...fixtures[0].props, w: Number.NaN } },
    ],
  ])("rejects %s", (_, record) => {
    expect(isLegacyCanvasNodeRecord(record)).toBe(false);
  });
});
