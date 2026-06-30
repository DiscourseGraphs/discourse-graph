import { contentTypes } from "@repo/content-model";
import type { CrossAppNode } from "./crossAppNodeContract";
import { spaceUriAndLocalIdToRid } from "./lib/rid";

const ROAM_SOURCE_SPACE_ID = "https://roamresearch.com/#/app/MAPLab";
const ROAM_SOURCE_NODE_ID = "tgWb6JozF";

const roamFullMarkdown = `# Sleep improves memory consolidation

Multiple studies show that sleep after learning strengthens memory traces.

- Supported by [[EVD]] - Rasch & Born 2013
`;

export const roamOriginNodeExample: CrossAppNode = {
  sourceApp: "roam",
  sourceSpaceId: ROAM_SOURCE_SPACE_ID,
  sourceSpaceName: "MAPLab",
  sourceNodeId: ROAM_SOURCE_NODE_ID,
  sourceNodeRid: spaceUriAndLocalIdToRid(
    ROAM_SOURCE_SPACE_ID,
    ROAM_SOURCE_NODE_ID,
  ),
  nodeType: {
    sourceNodeTypeId: "rCLM0schema",
    label: "Claim",
  },
  content: {
    direct: { value: "Sleep improves memory consolidation" },
    full: { format: contentTypes.markdown, value: roamFullMarkdown },
  },
  sourceModifiedAt: "2026-06-12T14:00:00.000Z",
};

const OBSIDIAN_SOURCE_SPACE_ID = "obsidian:9a8b7c6d5e4f3210";
const OBSIDIAN_SOURCE_NODE_ID = "0192f1a0-7b3c-7e2a-9f10-1a2b3c4d5e6f";
const OBSIDIAN_SOURCE_NODE_TYPE_ID = "evd-7c1f9a2b";

const obsidianFullMarkdown = `---
nodeTypeId: ${OBSIDIAN_SOURCE_NODE_TYPE_ID}
nodeInstanceId: ${OBSIDIAN_SOURCE_NODE_ID}
---

# REM sleep correlates with recall

Participants with more REM sleep showed better next-day recall.
`;

export const obsidianOriginNodeExample: CrossAppNode = {
  sourceApp: "obsidian",
  sourceSpaceId: OBSIDIAN_SOURCE_SPACE_ID,
  sourceSpaceName: "Research Vault",
  sourceNodeId: OBSIDIAN_SOURCE_NODE_ID,
  sourceNodeRid: spaceUriAndLocalIdToRid(
    OBSIDIAN_SOURCE_SPACE_ID,
    OBSIDIAN_SOURCE_NODE_ID,
    "note",
  ),
  nodeType: {
    sourceNodeTypeId: OBSIDIAN_SOURCE_NODE_TYPE_ID,
    label: "Evidence",
  },
  content: {
    direct: { value: "EVD - REM sleep and recall" },
    full: { format: contentTypes.markdown, value: obsidianFullMarkdown },
  },
  sourceModifiedAt: "2026-06-14T10:30:00.000Z",
};
