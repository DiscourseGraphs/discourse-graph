import { describe, expect, it } from "vitest";
import { MAX_ASSET_BYTES, isAssetTooLarge } from "../assetLimits";

const MIB = 1024 * 1024;

describe("the asset size cap", () => {
  it("is 6 MiB, at the bound the platforms allow", () => {
    expect(MAX_ASSET_BYTES).toBe(6 * MIB);
  });

  it("skips an asset above it, reporting rather than throwing", () => {
    let verdict: boolean | undefined;
    expect(() => {
      verdict = isAssetTooLarge(MAX_ASSET_BYTES + 1);
    }).not.toThrow();
    expect(verdict).toBe(true);
  });

  it("skips an asset exactly at it", () => {
    expect(isAssetTooLarge(MAX_ASSET_BYTES)).toBe(true);
  });

  it("transfers an asset below it", () => {
    expect(isAssetTooLarge(MAX_ASSET_BYTES - 1)).toBe(false);
    expect(isAssetTooLarge(0)).toBe(false);
  });
});
