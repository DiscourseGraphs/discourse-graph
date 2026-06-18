// The RID helpers now live in the shared database package so Roam and Obsidian
// share one cross-app identity format. See @repo/database/lib/rid.
export {
  spaceUriAndLocalIdToRid,
  ridToSpaceUriAndLocalId,
} from "@repo/database/lib/rid";
