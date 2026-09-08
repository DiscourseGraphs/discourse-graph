import { describe, expect, it } from "vitest";
import { checkChangelogSection } from "../releasePreflight";

describe("checkChangelogSection", () => {
  it("accepts a matching changelog section with release notes", () => {
    const changelog = `# Changelog

## [0.22.0] - 2026-08-23

### Added

- Add release preflight checks.

## [0.21.0] - 2026-06-22

- Previous release.
`;

    expect(checkChangelogSection({ changelog, version: "0.22.0" })).toEqual({
      status: "valid",
    });
  });

  it("accepts an undated section with a single release note", () => {
    const changelog = `# Changelog

## [0.22.0]

- Fix the release workflow.
`;

    expect(checkChangelogSection({ changelog, version: "0.22.0" })).toEqual({
      status: "valid",
    });
  });

  it("rejects a changelog without a matching version section", () => {
    const changelog = `# Changelog

## [0.21.0] - 2026-06-22

- Previous release.
`;

    expect(checkChangelogSection({ changelog, version: "0.22.0" })).toEqual({
      status: "missing",
    });
  });

  it("rejects a matching section without release notes", () => {
    const changelog = `# Changelog

## [0.22.0] - 2026-08-23

### Added

## [0.21.0] - 2026-06-22

- Previous release.
`;

    expect(checkChangelogSection({ changelog, version: "0.22.0" })).toEqual({
      status: "empty",
    });
  });

  it("rejects a matching section containing only a multi-line comment", () => {
    const changelog = `# Changelog

## [0.22.0]

<!--
TODO: Add release notes.
-->
`;

    expect(checkChangelogSection({ changelog, version: "0.22.0" })).toEqual({
      status: "empty",
    });
  });
});
