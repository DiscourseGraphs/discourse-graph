import path from "path";

// Base directories (relative to process.cwd())
const OBSIDIAN_DOCS = "app/(docs)/docs/obsidian/pages";
const ROAM_DOCS = "app/(docs)/docs/roam/pages";
const SHARED_DOCS = "app/(docs)/docs/shared";

type DocMapType = {
  default: string;
  [key: string]: string;
};

// Map URLs to actual file locations (relative paths)
export const docMap: DocMapType = {
  // Default directory for Obsidian docs
  default: OBSIDIAN_DOCS,

  // Fundamentals - use Roam docs
  "what-is-discourse-graph": ROAM_DOCS,
  grammar: ROAM_DOCS,

  // Use Cases - use Roam docs
  "literature-reviewing": ROAM_DOCS,
  "research-roadmapping": ROAM_DOCS,
  "reading-clubs": ROAM_DOCS,
  "lab-notebooks": ROAM_DOCS,
};
