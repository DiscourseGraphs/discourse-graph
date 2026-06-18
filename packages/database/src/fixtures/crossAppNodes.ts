import type {
  LocalConceptDataInput,
  LocalContentDataInput,
} from "../inputTypes";
import {
  FULL_CONTENT_FORMAT,
  type CrossAppNode,
} from "../crossAppNodeContract";
import { spaceUriAndLocalIdToRid } from "../lib/rid";

/**
 * Reference fixtures for the cross-app node content contract (ENG-1847).
 *
 * Each fixture pairs the contract-level `CrossAppNode` with the existing
 * `LocalConceptDataInput` + `LocalContentDataInput[]` it persists as — showing
 * downstream Roam/Obsidian tickets exactly how the contract maps onto
 * `upsert_concepts` / `upsert_content` without redefining the payload. The
 * fixtures use the `space_url` / `author_local_id` string keys so they stay
 * portable; the live source apps pass their resolved numeric `space_id` /
 * `author_id` from `SupabaseContext` instead.
 */
export type CrossAppNodeFixture = {
  node: CrossAppNode;
  concept: LocalConceptDataInput;
  contents: LocalContentDataInput[];
};

// --- Roam-origin node: a Claim shared from a Roam graph ---------------------

const ROAM_SPACE_URL = "https://roamresearch.com/#/app/MAPLab";
const ROAM_NODE_ID = "tgWb6JozF"; // a Roam block/page uid
const ROAM_CLAIM_SCHEMA_ID = "rCLM0schema"; // source_local_id of the Claim schema Concept
const ROAM_NODE_RID = spaceUriAndLocalIdToRid(ROAM_SPACE_URL, ROAM_NODE_ID);

const roamFullMarkdown = `# Sleep improves memory consolidation

Multiple studies show that sleep after learning strengthens memory traces.

- Supported by [[EVD]] - Rasch & Born 2013
`;

export const roamOriginNode: CrossAppNodeFixture = {
  node: {
    sourceApp: "Roam",
    sourceSpace: { url: ROAM_SPACE_URL, name: "MAPLab" },
    sourceLocalId: ROAM_NODE_ID,
    rid: ROAM_NODE_RID,
    nodeType: { sourceLocalId: ROAM_CLAIM_SCHEMA_ID, label: "Claim" },
    content: {
      direct: { value: "Sleep improves memory consolidation" },
      full: { format: FULL_CONTENT_FORMAT, value: roamFullMarkdown },
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

// --- Obsidian-origin node: an Evidence note shared from an Obsidian vault ----

const OBSIDIAN_VAULT_ID = "9a8b7c6d5e4f3210"; // app.appId
const OBSIDIAN_SPACE_URL = `obsidian:${OBSIDIAN_VAULT_ID}`;
const OBSIDIAN_NODE_ID = "0192f1a0-7b3c-7e2a-9f10-1a2b3c4d5e6f"; // uuidv7 nodeInstanceId
const OBSIDIAN_EVD_SCHEMA_ID = "evd-7c1f9a2b"; // nodeTypeId
const OBSIDIAN_FILE_PATH = "Discourse Nodes/EVD - REM sleep and recall.md";
const OBSIDIAN_TITLE = "EVD - REM sleep and recall"; // file basename
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
    sourceApp: "Obsidian",
    sourceSpace: { url: OBSIDIAN_SPACE_URL, name: "Research Vault" },
    sourceLocalId: OBSIDIAN_NODE_ID,
    rid: OBSIDIAN_NODE_RID,
    nodeType: { sourceLocalId: OBSIDIAN_EVD_SCHEMA_ID, label: "Evidence" },
    content: {
      direct: { value: OBSIDIAN_TITLE },
      full: { format: FULL_CONTENT_FORMAT, value: obsidianFullMarkdown },
    },
    sourceModifiedAt: "2026-06-14T10:30:00.000Z",
  },
  concept: {
    space_url: OBSIDIAN_SPACE_URL,
    name: OBSIDIAN_FILE_PATH, // Obsidian uses the file path as the Concept name
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
