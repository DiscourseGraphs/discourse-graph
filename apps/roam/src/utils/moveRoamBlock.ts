// Roam's moveBlock API requires the kebab-case "parent-uid" key.
/* eslint-disable @typescript-eslint/naming-convention */
export const moveRoamBlockToIndex = ({
  blockUid,
  parentUid,
  sourceIndex,
  destIndex,
}: {
  blockUid: string;
  parentUid: string;
  sourceIndex: number;
  destIndex: number;
}) => {
  const finalIndex = destIndex > sourceIndex ? destIndex + 1 : destIndex;
  return window.roamAlphaAPI.moveBlock({
    location: { "parent-uid": parentUid, order: finalIndex },
    block: { uid: blockUid },
  });
};
