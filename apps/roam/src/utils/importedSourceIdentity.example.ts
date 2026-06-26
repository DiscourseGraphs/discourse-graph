import type { CrossAppNode } from "@repo/database/crossAppNodeContract";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import {
  toImportedSourceIdentity,
  type ImportedSourceIdentity,
} from "./importedSourceIdentity";

/**
 * Example of the source identity persisted on a Roam page when an Obsidian-origin
 * shared node is imported. Derived from the cross-app node contract so the stored
 * shape stays in lockstep with `CrossAppNode`. Not imported by runtime code; this
 * file exists to type-check and document the stored metadata.
 *
 * The source node type is intentionally absent from the stored identity: node-type
 * mapping is the materializer's concern (ENG-1858), not ENG-1856's.
 */

const OBSIDIAN_SOURCE_SPACE_ID = "obsidian:9a8b7c6d5e4f3210";
const OBSIDIAN_SOURCE_NODE_ID = "0192f1a0-7b3c-7e2a-9f10-1a2b3c4d5e6f";

const obsidianOriginNode: CrossAppNode = {
  sourceApp: "obsidian",
  sourceSpaceId: OBSIDIAN_SOURCE_SPACE_ID,
  sourceSpaceName: "Research Vault",
  sourceNodeId: OBSIDIAN_SOURCE_NODE_ID,
  sourceNodeRid: spaceUriAndLocalIdToRid(
    OBSIDIAN_SOURCE_SPACE_ID,
    OBSIDIAN_SOURCE_NODE_ID,
    "note",
  ),
  nodeType: { sourceNodeTypeId: "evd-7c1f9a2b", label: "Evidence" },
  content: {
    direct: { value: "EVD - REM sleep and recall" },
    full: {
      format: "text/markdown",
      value: "# REM sleep correlates with recall\n",
    },
  },
  sourceModifiedAt: "2026-06-14T10:30:00.000Z",
};

export const obsidianImportedIdentityExample: ImportedSourceIdentity =
  toImportedSourceIdentity(obsidianOriginNode);
