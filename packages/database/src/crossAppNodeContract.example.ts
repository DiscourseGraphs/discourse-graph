import { contentTypes } from "@repo/content-model";
import type { CrossAppNode } from "./crossAppContracts";

// const ROAM_SOURCE_SPACE_ID = "https://roamresearch.com/#/app/MAPLab";
const ROAM_SOURCE_NODE_ID = "tgWb6JozF";

const roamFullMarkdown = `# Sleep improves memory consolidation

Multiple studies show that sleep after learning strengthens memory traces.

- Supported by [[EVD]] - Rasch & Born 2013
`;

export const roamOriginNodeExample: CrossAppNode = {
  localId: ROAM_SOURCE_NODE_ID,
  nodeType: {
    localId: "rCLM0schema",
  },
  content: {
    direct: {
      value: "Sleep improves memory consolidation",
      author: { localId: "someone" },
    },
    full: {
      contentType: contentTypes.markdown,
      value: roamFullMarkdown,
      author: { localId: "someone" },
    },
  },
  createdAt: new Date("2026-06-12T14:00:00.000Z"),
  modifiedAt: new Date("2026-06-12T15:00:00.000Z"),
  author: { localId: "maparent" },
};

// const OBSIDIAN_SOURCE_SPACE_ID = "obsidian:9a8b7c6d5e4f3210";
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
  localId: OBSIDIAN_SOURCE_NODE_ID,
  nodeType: {
    localId: OBSIDIAN_SOURCE_NODE_TYPE_ID,
  },
  content: {
    direct: {
      value: "EVD - REM sleep and recall",
      author: { localId: "someone" },
    },
    full: {
      contentType: contentTypes.markdown,
      value: obsidianFullMarkdown,
      author: { localId: "someone" },
    },
  },
  createdAt: new Date("2026-06-14T10:30:00.000Z"),
  modifiedAt: new Date("2026-06-14T15:00:00.000Z"),
  author: { localId: "maparent" },
};
