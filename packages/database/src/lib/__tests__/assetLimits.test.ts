import { describe, expect, it } from "vitest";
import {
  MAX_IMPORTED_ASSET_BYTES,
  MAX_PUBLISHED_ASSET_BYTES,
  isAssetTooLarge,
} from "../assetLimits";

const MIB = 1024 * 1024;

describe("asset size caps", () => {
  it("holds each direction as its own named constant", () => {
    expect(MAX_PUBLISHED_ASSET_BYTES).toBe(6 * MIB);
    expect(MAX_IMPORTED_ASSET_BYTES).toBe(6 * MIB);
  });
});

describe.each([
  ["publish", MAX_PUBLISHED_ASSET_BYTES],
  ["import", MAX_IMPORTED_ASSET_BYTES],
])("the %s cap", (_direction, limit) => {
  it("skips an asset above it, reporting rather than throwing", () => {
    let verdict: boolean | undefined;
    expect(() => {
      verdict = isAssetTooLarge({ size: limit + 1, limit });
    }).not.toThrow();
    expect(verdict).toBe(true);
  });

  it("skips an asset exactly at it", () => {
    expect(isAssetTooLarge({ size: limit, limit })).toBe(true);
  });

  it("transfers an asset below it", () => {
    expect(isAssetTooLarge({ size: limit - 1, limit })).toBe(false);
    expect(isAssetTooLarge({ size: 0, limit })).toBe(false);
  });
});
