const ROAM_DOCS = "app/(docs)/docs/roam/pages";
const SHARED_DOCS = "app/(docs)/docs/sharedPages";

type DocMapType = {
  default: string;
  [key: string]: string;
};

export const docMap: DocMapType = {
  default: ROAM_DOCS,
  "what-is-discourse-graph": SHARED_DOCS,
  "base-grammar": SHARED_DOCS,
  "literature-reviewing": SHARED_DOCS,
  "research-roadmapping": SHARED_DOCS,
  "reading-clubs": SHARED_DOCS,
  "lab-notebooks": SHARED_DOCS,
};
