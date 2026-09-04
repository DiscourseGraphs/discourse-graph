import { settleBlockPropWrites } from "./setBlockProps";

type PendingWrite = () => void;

// Some setting panels defer their block-prop write behind a short timer so that
// typing or dragging a control does not write to Roam on every event. That leaves
// a window where a reader sees the previous value, and where unmounting the panel
// would drop the write entirely. Panels register their pending commit here so a
// caller that is about to read settings can commit them first.
const pendingWrites = new Set<PendingWrite>();

export const addPendingSettingWrite = (write: PendingWrite): void => {
  pendingWrites.add(write);
};

export const removePendingSettingWrite = (write: PendingWrite): void => {
  pendingWrites.delete(write);
};

/**
 * Commits every deferred write and waits for Roam to apply it. Awaiting matters:
 * the commits themselves only *start* a block update, so a caller that read
 * immediately after a synchronous flush could still observe the previous value.
 */
export const flushPendingSettingWrites = async (): Promise<void> => {
  // Snapshots and clears before running so that a commit which schedules further
  // work cannot be run twice by the same flush.
  const writes = Array.from(pendingWrites);
  pendingWrites.clear();
  writes.forEach((write) => write());
  await settleBlockPropWrites();
};

export const countPendingSettingWrites = (): number => pendingWrites.size;
