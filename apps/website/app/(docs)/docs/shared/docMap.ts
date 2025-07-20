// Shared paths
export const SHARED_DOCS = "app/(docs)/docs/sharedPages";

// Shared document mappings
export const sharedDocMap = {
  "what-is-discourse-graph": SHARED_DOCS,
  "base-grammar": SHARED_DOCS,
  "literature-reviewing": SHARED_DOCS,
  "research-roadmapping": SHARED_DOCS,
  "reading-clubs": SHARED_DOCS,
  "lab-notebooks": SHARED_DOCS,
} as const;

// Type for platform-specific docMaps
export type DocMapType = {
  default: string;
  [key: string]: string;
}; 