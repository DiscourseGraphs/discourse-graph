import { describe, expect, it } from "vitest";
import { createVersionStamp, normalizeBuildBranch } from "~/utils/getVersion";

describe("createVersionStamp", () => {
  it("includes the short commit SHA for main builds", () => {
    expect(
      createVersionStamp({
        version: "0.20.0",
        buildDate: "2026-06-22",
        buildBranch: "main",
        buildCommit: "1234567890abcdef",
      }),
    ).toBe("0.20.0-2026-06-22-12345678");
  });

  it("includes a normalized branch between the date and commit SHA", () => {
    expect(
      createVersionStamp({
        version: "0.20.0",
        buildDate: "2026-06-22",
        buildBranch: "feature/branch build",
        buildCommit: "abcdef1234567890",
      }),
    ).toBe("0.20.0-2026-06-22-feature-branch-build-abcdef12");
  });

  it("falls back to the existing date stamp when Git metadata is missing", () => {
    expect(
      createVersionStamp({
        version: "0.20.0",
        buildDate: "2026-06-22",
        buildBranch: " ",
        buildCommit: "-",
      }),
    ).toBe("0.20.0-2026-06-22");
  });
});

describe("normalizeBuildBranch", () => {
  it("omits branch metadata for main and detached HEAD builds", () => {
    expect(normalizeBuildBranch("main")).toBeUndefined();
    expect(normalizeBuildBranch("HEAD")).toBeUndefined();
  });
});
