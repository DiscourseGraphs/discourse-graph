import type {
  LocalConceptDataInput,
  LocalContentDataInput,
} from "../inputTypes";
import type { CrossAppNode } from "../crossAppNodeContract";
import { spaceUriAndLocalIdToRid } from "../lib/rid";

/**
 * Contract fixtures with the database inputs they persist as.
 *
 * These use portable string keys; live apps resolve numeric IDs through
 * `SupabaseContext`.
 */
export type CrossAppNodeFixture = {
  node: CrossAppNode;
  concept: LocalConceptDataInput;
  contents: LocalContentDataInput[];
};

const ROAM_SPACE_URL = "https://roamresearch.com/#/app/MAPLab";
const ROAM_NODE_ID = "tgWb6JozF";
const ROAM_CLAIM_SCHEMA_ID = "rCLM0schema";
const ROAM_NODE_RID = spaceUriAndLocalIdToRid(ROAM_SPACE_URL, ROAM_NODE_ID);

const roamFullMarkdown = `# Sleep improves memory consolidation

Multiple studies show that sleep after learning strengthens memory traces.

- Supported by [[EVD]] - Rasch & Born 2013
`;

export const roamOriginNode: CrossAppNodeFixture = {
  node: {
    sourceApp: "roam",
    sourceSpaceId: ROAM_SPACE_URL,
    sourceSpaceName: "MAPLab",
    sourceNodeId: ROAM_NODE_ID,
    sourceNodeRid: ROAM_NODE_RID,
    nodeType: { sourceNodeTypeId: ROAM_CLAIM_SCHEMA_ID, label: "Claim" },
    content: {
      direct: { value: "Sleep improves memory consolidation" },
      full: { format: "text/markdown", value: roamFullMarkdown },
    },
    sourceModifiedAt: "2026-06-12T14:00:00.000Z",
  },
  concept: {
    space_url: ROAM_SPACE_URL,
    name: "Sleep improves memory consolidation",
    source_local_id: ROAM_NODE_ID,
    schema_represented_by_local_id: ROAM_CLAIM_SCHEMA_ID,
    is_schema: false,
    author_local_id: "roam-account-uid",
    created: "2026-06-10T09:00:00.000Z",
    last_modified: "2026-06-12T14:00:00.000Z",
  },
  contents: [
    {
      space_url: ROAM_SPACE_URL,
      source_local_id: ROAM_NODE_ID,
      variant: "direct",
      scale: "document",
      text: "Sleep improves memory consolidation",
      author_local_id: "roam-account-uid",
      created: "2026-06-10T09:00:00.000Z",
      last_modified: "2026-06-12T14:00:00.000Z",
    },
    {
      space_url: ROAM_SPACE_URL,
      source_local_id: ROAM_NODE_ID,
      variant: "full",
      scale: "document",
      text: roamFullMarkdown,
      author_local_id: "roam-account-uid",
      created: "2026-06-10T09:00:00.000Z",
      last_modified: "2026-06-12T14:00:00.000Z",
    },
  ],
};

const OBSIDIAN_VAULT_ID = "9a8b7c6d5e4f3210";
const OBSIDIAN_SPACE_URL = `obsidian:${OBSIDIAN_VAULT_ID}`;
const OBSIDIAN_NODE_ID = "0192f1a0-7b3c-7e2a-9f10-1a2b3c4d5e6f";
const OBSIDIAN_EVD_SCHEMA_ID = "evd-7c1f9a2b";
const OBSIDIAN_FILE_PATH = "Discourse Nodes/EVD - REM sleep and recall.md";
const OBSIDIAN_TITLE = "EVD - REM sleep and recall";
const OBSIDIAN_NODE_RID = spaceUriAndLocalIdToRid(
  OBSIDIAN_SPACE_URL,
  OBSIDIAN_NODE_ID,
  "note",
);

// Obsidian's `full` variant is the entire file as read from the vault, which
// includes the YAML frontmatter — a known markdown-fidelity wrinkle the
// destination materialization (ENG-1858 / ENG-1872) must handle.
const obsidianFullMarkdown = `---
nodeTypeId: ${OBSIDIAN_EVD_SCHEMA_ID}
nodeInstanceId: ${OBSIDIAN_NODE_ID}
---

# REM sleep correlates with recall

Participants with more REM sleep showed better next-day recall.
`;

export const obsidianOriginNode: CrossAppNodeFixture = {
  node: {
    sourceApp: "obsidian",
    sourceSpaceId: OBSIDIAN_SPACE_URL,
    sourceSpaceName: "Research Vault",
    sourceNodeId: OBSIDIAN_NODE_ID,
    sourceNodeRid: OBSIDIAN_NODE_RID,
    nodeType: { sourceNodeTypeId: OBSIDIAN_EVD_SCHEMA_ID, label: "Evidence" },
    content: {
      direct: { value: OBSIDIAN_TITLE },
      full: { format: "text/markdown", value: obsidianFullMarkdown },
    },
    sourceModifiedAt: "2026-06-14T10:30:00.000Z",
  },
  concept: {
    space_url: OBSIDIAN_SPACE_URL,
    name: OBSIDIAN_FILE_PATH,
    source_local_id: OBSIDIAN_NODE_ID,
    schema_represented_by_local_id: OBSIDIAN_EVD_SCHEMA_ID,
    is_schema: false,
    author_local_id: "obsidian-account-uid",
    created: "2026-06-13T08:00:00.000Z",
    last_modified: "2026-06-14T10:30:00.000Z",
    literal_content: { label: OBSIDIAN_TITLE },
  },
  contents: [
    {
      space_url: OBSIDIAN_SPACE_URL,
      source_local_id: OBSIDIAN_NODE_ID,
      variant: "direct",
      scale: "document",
      text: OBSIDIAN_TITLE,
      author_local_id: "obsidian-account-uid",
      created: "2026-06-13T08:00:00.000Z",
      last_modified: "2026-06-14T10:30:00.000Z",
      metadata: { filePath: OBSIDIAN_FILE_PATH },
    },
    {
      space_url: OBSIDIAN_SPACE_URL,
      source_local_id: OBSIDIAN_NODE_ID,
      variant: "full",
      scale: "document",
      text: obsidianFullMarkdown,
      author_local_id: "obsidian-account-uid",
      created: "2026-06-13T08:00:00.000Z",
      last_modified: "2026-06-14T10:30:00.000Z",
      metadata: { filePath: OBSIDIAN_FILE_PATH },
    },
  ],
};
