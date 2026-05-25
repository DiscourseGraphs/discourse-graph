import React from "react";

const ROAM_DOCS_BASE_URL = "https://discoursegraphs.com/docs/roam";

export const ROAM_DOCS = {
  creatingNodes: `${ROAM_DOCS_BASE_URL}/guides/creating-discourse-nodes`,
  taggingCandidateNodes: `${ROAM_DOCS_BASE_URL}/guides/tagging-candidate-nodes`,
  querying: `${ROAM_DOCS_BASE_URL}/guides/querying-discourse-graph`,
  sharing: `${ROAM_DOCS_BASE_URL}/guides/sharing-discourse-graph`,
  migrationToStoredRelations: `${ROAM_DOCS_BASE_URL}/guides/migration-to-stored-relations`,
  storedRelations: `${ROAM_DOCS_BASE_URL}/fundamentals/grammar/stored-relations`,
  grammarNodes: `${ROAM_DOCS_BASE_URL}/fundamentals/grammar/nodes`,
  discourseContextOverlay: `${ROAM_DOCS_BASE_URL}/guides/exploring-discourse-graph/discourse-context-overlay`,
  discourseAttributes: `${ROAM_DOCS_BASE_URL}/guides/exploring-discourse-graph/discourse-attributes`,
} as const;

export const withDocsLink = (
  description: React.ReactNode,
  href: string,
): React.ReactNode => (
  <>
    {description}{" "}
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      See more.
    </a>
  </>
);
