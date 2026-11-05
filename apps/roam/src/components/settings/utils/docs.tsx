import React from "react";

const ROAM_DOCS_BASE_URL = "https://discoursegraphs.com/docs/roam";

export const ROAM_DOCS = {
  creatingNodes: `${ROAM_DOCS_BASE_URL}/guides/creating-discourse-nodes`,
  candidateNodeTagSetup: `${ROAM_DOCS_BASE_URL}/guides/tagging-candidate-nodes#setup---define-candidate-nodes`,
  exportOptions: `${ROAM_DOCS_BASE_URL}/guides/sharing-discourse-graph#export-options`,
  migrationToStoredRelations: `${ROAM_DOCS_BASE_URL}/guides/migration-to-stored-relations`,
  enableStoredRelations: `${ROAM_DOCS_BASE_URL}/guides/migration-to-stored-relations#turn-on-stored-relations-for-an-existing-install`,
  discourseContextOverlay: `${ROAM_DOCS_BASE_URL}/guides/exploring-discourse-graph/discourse-context-overlay`,
  discourseScore: `${ROAM_DOCS_BASE_URL}/guides/exploring-discourse-graph/discourse-context-overlay#discourse-score`,
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
      View docs
    </a>
  </>
);
