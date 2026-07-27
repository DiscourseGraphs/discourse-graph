import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  markdownToSearchText,
  routePathFromContentFile,
  searchFiltersFromContentFile,
} from "./build-docs-search-index.mjs";

/**
 * @typedef {{ scripts: { build: string, postbuild?: string } }} WebsitePackageJson
 * @typedef {{ tasks: { build: { outputs: string[] } } }} TurboJson
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * @param {unknown} value
 * @returns {value is string[]}
 */
const isStringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * @param {string} filePath
 * @returns {unknown}
 */
const readJsonFile = (filePath) =>
  /** @type {unknown} */ (JSON.parse(fs.readFileSync(filePath, "utf8")));

/**
 * @param {unknown} value
 * @returns {WebsitePackageJson}
 */
const assertWebsitePackageJson = (value) => {
  assert.ok(isRecord(value));
  assert.ok(isRecord(value.scripts));
  assert.equal(typeof value.scripts.build, "string");
  assert.ok(
    value.scripts.postbuild === undefined ||
      typeof value.scripts.postbuild === "string",
  );

  return /** @type {WebsitePackageJson} */ (value);
};

/**
 * @param {unknown} value
 * @returns {TurboJson}
 */
const assertTurboJson = (value) => {
  assert.ok(isRecord(value));
  assert.ok(isRecord(value.tasks));
  assert.ok(isRecord(value.tasks.build));
  assert.ok(isStringArray(value.tasks.build.outputs));

  return /** @type {TurboJson} */ (value);
};

void test("routePathFromContentFile maps content files to canonical docs routes", () => {
  assert.equal(
    routePathFromContentFile(
      path.join(
        process.cwd(),
        "content",
        "roam",
        "welcome",
        "getting-started.md",
      ),
    ),
    "/docs/roam/welcome/getting-started",
  );
  assert.equal(
    routePathFromContentFile(
      path.join(process.cwd(), "content", "obsidian", "index.mdx"),
    ),
    "/docs/obsidian",
  );
  assert.equal(
    routePathFromContentFile(path.join(process.cwd(), "content", "index.mdx")),
    "/docs",
  );
});

void test("markdownToSearchText strips MDX component markup but keeps readable text", () => {
  const source = `import { Callout } from "nextra/components"

# Documentation

Choose the \`/docs\` routes.

<Callout type="info">
  Shared conceptual docs stay stable.
</Callout>

- [Roam docs](/docs/roam)
`;

  assert.equal(
    markdownToSearchText(source),
    "Documentation Choose the /docs routes. Shared conceptual docs stay stable. Roam docs",
  );
});

void test("searchFiltersFromContentFile scopes docs records by platform", () => {
  assert.deepEqual(
    searchFiltersFromContentFile(
      path.join(
        process.cwd(),
        "content",
        "roam",
        "welcome",
        "getting-started.md",
      ),
    ),
    { platform: ["roam"] },
  );
  assert.deepEqual(
    searchFiltersFromContentFile(
      path.join(process.cwd(), "content", "obsidian", "index.mdx"),
    ),
    { platform: ["obsidian"] },
  );
  assert.equal(
    searchFiltersFromContentFile(
      path.join(process.cwd(), "content", "index.mdx"),
    ),
    undefined,
  );
});

void test("build configuration includes generated Pagefind assets", () => {
  const packageJson = assertWebsitePackageJson(readJsonFile("package.json"));
  assert.match(
    packageJson.scripts.build,
    /build-docs-search-index\.mjs/u,
    "website build must generate the Pagefind index when run by Turbo",
  );
  assert.doesNotMatch(
    packageJson.scripts.postbuild ?? "",
    /build-docs-search-index\.mjs/u,
    "Turbo does not run package postbuild hooks for this task",
  );

  const turboJson = assertTurboJson(
    readJsonFile(path.join("..", "..", "turbo.json")),
  );
  assert.ok(
    turboJson.tasks.build.outputs.includes("public/_pagefind/**"),
    "Turbo must cache and restore the generated Pagefind assets",
  );
});
