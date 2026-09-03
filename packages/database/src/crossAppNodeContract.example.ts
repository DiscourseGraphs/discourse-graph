import { contentTypes } from "@repo/content-model";
import type { CrossAppNode } from "./crossAppContracts";

// const ROAM_SOURCE_SPACE_ID = "https://roamresearch.com/#/app/MAPLab";
const ROAM_SOURCE_NODE_ID = "tgWb6JozF";

// Roam addresses assets by URL. Both of these are the tokens the source page holds,
// and publication leaves them exactly as they are.
const ROAM_STORED_ASSET_URL =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FlqP2ioVNC3.png?alt=media&token=9f1c07a4-2b3e-4c5d-8a91-6e0f2d7b4c13";
// Bytes that could not be copied at publication. It is embedded in the markdown below
// with Roam's own PDF syntax — so a destination scanning for embeds does find it — but
// is deliberately absent from `assets`: an unresolvable asset has no recorded reference
// at all, so the destination finds no entry for this token and leaves it in place.
const ROAM_UNRESOLVABLE_ASSET_URL =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FGVfB6XBcMR.pdf?alt=media&token=3a5d81b6-7c24-4e19-b0f8-52ca9e3d1f07";

const roamFullMarkdown = `# Sleep improves memory consolidation

Multiple studies show that sleep after learning strengthens memory traces.

![](${ROAM_STORED_ASSET_URL})

- Supported by [[EVD]] - Rasch & Born 2013
- Protocol: {{[[pdf]]: ${ROAM_UNRESOLVABLE_ASSET_URL}}}
`;

export const roamOriginNodeExample: CrossAppNode = {
  localId: ROAM_SOURCE_NODE_ID,
  nodeType: "rCLM0schema",
  coreTitle: "Sleep improves memory consolidation",
  content: {
    direct: {
      value: "Sleep improves memory consolidation",
      authorId: "someone",
    },
    full: {
      contentType: contentTypes.markdown,
      value: roamFullMarkdown,
      authorId: "someone",
    },
  },
  assets: [
    {
      sourceRef: ROAM_STORED_ASSET_URL,
      contentHash:
        "e030fe745078ef6ea92f5cf4f65a0d93755ba9abe1bb53653da5f4b7cdb91a57",
      // Roam keeps the uploaded name in Firebase custom metadata; the publisher reads
      // it from there, because the URL itself carries only a random storage uid.
      sourcePath: "CleanShot 2025-11-16 at 17.14.44@2x.png",
    },
  ],
  createdAt: new Date("2026-06-12T14:00:00.000Z"),
  modifiedAt: new Date("2026-06-12T15:00:00.000Z"),
  authorId: "maparent",
};

// const OBSIDIAN_SOURCE_SPACE_ID = "obsidian:9a8b7c6d5e4f3210";
const OBSIDIAN_SOURCE_NODE_ID = "0192f1a0-7b3c-7e2a-9f10-1a2b3c4d5e6f";
const OBSIDIAN_SOURCE_NODE_TYPE_ID = "evd-7c1f9a2b";
// Obsidian addresses assets by vault path, and publication carries the path unchanged.
const OBSIDIAN_ASSET_PATH = "attachments/rem-sleep-recall.png";

const obsidianFullMarkdown = `---
nodeTypeId: ${OBSIDIAN_SOURCE_NODE_TYPE_ID}
nodeInstanceId: ${OBSIDIAN_SOURCE_NODE_ID}
---

# REM sleep correlates with recall

Participants with more REM sleep showed better next-day recall.

![[${OBSIDIAN_ASSET_PATH}]]
`;

export const obsidianOriginNodeExample: CrossAppNode = {
  localId: OBSIDIAN_SOURCE_NODE_ID,
  nodeType: OBSIDIAN_SOURCE_NODE_TYPE_ID,
  coreTitle: "REM sleep and recall",
  content: {
    direct: {
      value: "EVD - REM sleep and recall",
      authorId: "someone",
    },
    full: {
      contentType: contentTypes.markdown,
      value: obsidianFullMarkdown,
      authorId: "someone",
    },
  },
  assets: [
    {
      sourceRef: OBSIDIAN_ASSET_PATH,
      contentHash:
        "b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78",
      // No sourcePath: an Obsidian sourceRef is already a vault path, which a
      // destination can decompose on its own.
    },
  ],
  createdAt: new Date("2026-06-14T10:30:00.000Z"),
  modifiedAt: new Date("2026-06-14T15:00:00.000Z"),
  authorId: "maparent",
};
