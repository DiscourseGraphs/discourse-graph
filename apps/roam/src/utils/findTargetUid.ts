import {
  isRid,
  ridToSpaceUriAndLocalId,
  spaceUriAndLocalIdToRid,
} from "@repo/database/lib/rid";
import canonicalRoamUrl from "./canonicalRoamUrl";
import { findImportedNodeUidBySourceRid } from "./importedSourceIdentity";

// A shared node refers to another node by its bare local id when both live in the same
// space, and by a RID otherwise. "note" is the subtype node RIDs carry; URL-shaped Roam
// RIDs ignore it.
export const sharedReferenceRid = (
  localOrRid: string,
  spaceUri: string,
): string =>
  isRid(localOrRid)
    ? localOrRid
    : spaceUriAndLocalIdToRid(spaceUri, localOrRid, "note");

// The local page for a node another space refers to: its own uid when the RID points
// into this graph, else the page imported from it.
export const findTargetUid = async (
  localOrRid: string,
  spaceUri: string,
): Promise<string | null> => {
  const rid = sharedReferenceRid(localOrRid, spaceUri);
  const { spaceUri: ridSpaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(rid);
  if (ridSpaceUri === canonicalRoamUrl()) {
    const result = window.roamAlphaAPI.q(
      "[:find (?e) :in $ ?uid :where [?e :block/uid ?uid]]",
      sourceLocalId,
    );
    if (!result || result.length === 0) return null;
    return sourceLocalId;
  }
  return await findImportedNodeUidBySourceRid(rid);
};
