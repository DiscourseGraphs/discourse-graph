export const ROAM_DOC_SECTIONS = {
  welcome: ["getting-started", "installation", "installation-roam-depot"],
  guides: [
    "creating-discourse-nodes",
    "tagging-candidate-nodes",
    "creating-discourse-relationships",
    "exploring-discourse-graph",
    "querying-discourse-graph",
    "extending-personalizing-graph",
    "sharing-discourse-graph",
  ],
  fundamentals: [
    "what-is-a-discourse-graph",
    "grammar",
    "nodes",
    "operators-relations",
    "base-grammar",
    "stored-relations",
    "migration-to-stored-relations",
    "relations-patterns",
  ],
  "views-and-tools": [
    "discourse-context",
    "discourse-context-overlay",
    "discourse-attributes",
    "node-index",
  ],
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
  "core-features": [
    "creating-discourse-nodes",
    "creating-discourse-relationships",
    "discourse-context",
    "canvas",
    "node-tags",
  ],
  "advanced-features": ["command-palette", "sync-and-import"],
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

export const DOCS_REDIRECTS: Redirect[] = [
  ...buildPlatformRedirects("roam", ROAM_DOC_SECTIONS),
  ...buildPlatformRedirects("obsidian", OBSIDIAN_DOC_SECTIONS),
];
