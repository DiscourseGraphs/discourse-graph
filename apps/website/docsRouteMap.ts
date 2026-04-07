export const ROAM_DOC_SECTIONS = {
  welcome: ["getting-started", "installation"],
  guides: [
    "creating-discourse-nodes",
    "tagging-candidate-nodes",
    "creating-discourse-relationships",
    "migration-to-stored-relations",
    "exploring-discourse-graph",
    "querying-discourse-graph",
    "extending-personalizing-graph",
    "sharing-discourse-graph",
  ],
  fundamentals: ["what-is-a-discourse-graph", "grammar", "relations-patterns"],

  // eslint-disable-next-line @typescript-eslint/naming-convention
  "use-cases": [
    "literature-reviewing",
    "enhanced-zettelkasten",
    "reading-clubs",
    "lab-notebooks",
    "research-roadmapping",
  ],
} as const;

export const OBSIDIAN_DOC_SECTIONS = {
  welcome: ["getting-started", "installation"],
  fundamentals: ["what-is-a-discourse-graph", "base-grammar"],
  configuration: [
    "node-types-templates",
    "relationship-types",
    "general-settings",
  ],
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "core-features": [
    "creating-discourse-nodes",
    "creating-discourse-relationships",
    "discourse-context",
    "canvas",
    "node-tags",
  ],
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "advanced-features": ["command-palette", "sync-and-import"],
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "use-cases": [
    "literature-reviewing",
    "research-roadmapping",
    "reading-clubs",
    "lab-notebooks",
  ],
} as const;

type Redirect = {
  source: string;
  destination: string;
  permanent: boolean;
};

const createRedirect = (source: string, destination: string): Redirect => ({
  source,
  destination,
  permanent: true,
});

const buildPlatformRedirects = (
  platform: "roam" | "obsidian",
  sections: Record<string, readonly string[]>,
): Redirect[] =>
  Object.entries(sections).flatMap(([section, slugs]) =>
    slugs.map((slug) => ({
      source: `/docs/${platform}/${slug}`,
      destination: `/docs/${platform}/${section}/${slug}`,
      permanent: true,
    })),
  );

const ROAM_CUSTOM_REDIRECTS: Redirect[] = [
  createRedirect(
    "/docs/roam/discourse-context",
    "/docs/roam/guides/exploring-discourse-graph/discourse-context",
  ),
  createRedirect(
    "/docs/roam/discourse-context-overlay",
    "/docs/roam/guides/exploring-discourse-graph/discourse-context-overlay",
  ),
  createRedirect(
    "/docs/roam/discourse-attributes",
    "/docs/roam/guides/exploring-discourse-graph/discourse-attributes",
  ),
  createRedirect(
    "/docs/roam/node-index",
    "/docs/roam/guides/exploring-discourse-graph/node-index",
  ),
  createRedirect(
    "/docs/roam/views-and-tools/discourse-context",
    "/docs/roam/guides/exploring-discourse-graph/discourse-context",
  ),
  createRedirect(
    "/docs/roam/views-and-tools/discourse-context-overlay",
    "/docs/roam/guides/exploring-discourse-graph/discourse-context-overlay",
  ),
  createRedirect(
    "/docs/roam/views-and-tools/discourse-attributes",
    "/docs/roam/guides/exploring-discourse-graph/discourse-attributes",
  ),
  createRedirect(
    "/docs/roam/views-and-tools/node-index",
    "/docs/roam/guides/exploring-discourse-graph/node-index",
  ),
  createRedirect("/docs/roam/nodes", "/docs/roam/fundamentals/grammar/nodes"),
  createRedirect(
    "/docs/roam/operators-relations",
    "/docs/roam/fundamentals/grammar/operators-relations",
  ),
  createRedirect(
    "/docs/roam/base-grammar",
    "/docs/roam/fundamentals/grammar/base-grammar",
  ),
  createRedirect(
    "/docs/roam/stored-relations",
    "/docs/roam/fundamentals/grammar/stored-relations",
  ),
  createRedirect(
    "/docs/roam/fundamentals/nodes",
    "/docs/roam/fundamentals/grammar/nodes",
  ),
  createRedirect(
    "/docs/roam/fundamentals/operators-relations",
    "/docs/roam/fundamentals/grammar/operators-relations",
  ),
  createRedirect(
    "/docs/roam/fundamentals/base-grammar",
    "/docs/roam/fundamentals/grammar/base-grammar",
  ),
  createRedirect(
    "/docs/roam/fundamentals/stored-relations",
    "/docs/roam/fundamentals/grammar/stored-relations",
  ),
  createRedirect(
    "/docs/roam/fundamentals/migration-to-stored-relations",
    "/docs/roam/guides/migration-to-stored-relations",
  ),
];

export const DOCS_REDIRECTS: Redirect[] = [
  ...ROAM_CUSTOM_REDIRECTS,
  ...buildPlatformRedirects("roam", ROAM_DOC_SECTIONS),
  ...buildPlatformRedirects("obsidian", OBSIDIAN_DOC_SECTIONS),
];
