const OBSIDIAN_DOCS = "app/(docs)/docs/obsidian/pages";
const ROAM_DOCS = "app/(docs)/docs/roam/pages";
const SHARED_DOCS = "app/(docs)/docs/sharedPages";

type DocMapType = {
  default: string;
  [key: string]: string;
};

// Map URLs to actual file locations (relative paths)
export const docMap: DocMapType = {
  // Default directory for Obsidian docs
  default: OBSIDIAN_DOCS,

  // Fundamentals - use Roam docs
  // TODO: use shared docs when restructure Roam docs too
  "what-is-discourse-graph": SHARED_DOCS,
  grammar: SHARED_DOCS,

  // TODO: use shared docs when restructure Roam docs too
  "literature-reviewing": SHARED_DOCS,
  "research-roadmapping": SHARED_DOCS,
  "reading-clubs": SHARED_DOCS,
  "lab-notebooks": SHARED_DOCS,
};
