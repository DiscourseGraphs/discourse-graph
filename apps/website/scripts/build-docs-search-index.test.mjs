import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  markdownToSearchText,
  routePathFromContentFile,
  searchFiltersFromContentFile,
} from "./build-docs-search-index.mjs";

void test("routePathFromContentFile maps content files to canonical docs routes", () => {
  assert.equal(
    routePathFromContentFile(
      path.join(process.cwd(), "content", "roam", "welcome", "getting-started.md"),
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
    'Documentation Choose the /docs routes. Shared conceptual docs stay stable. Roam docs',
  );
});

void test("searchFiltersFromContentFile scopes docs records by platform", () => {
  assert.deepEqual(
    searchFiltersFromContentFile(
      path.join(process.cwd(), "content", "roam", "welcome", "getting-started.md"),
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
    searchFiltersFromContentFile(path.join(process.cwd(), "content", "index.mdx")),
    undefined,
  );
});
