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
    // eslint-disable-next-line @typescript-eslint/naming-convention
    location: { "parent-uid": parentUid, order: finalIndex },
    block: { uid: blockUid },
  });
};
