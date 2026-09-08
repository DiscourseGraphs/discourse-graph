import { settleTrackedRoamWrites } from "./setBlockProps";

type PendingWrite = () => void | Promise<void>;

// Panels defer their block-prop write behind a timer. Registering the pending commit
// lets a reader commit everything first instead of seeing a stale value.
const pendingWrites = new Set<PendingWrite>();

export const addPendingSettingWrite = (write: PendingWrite): void => {
  pendingWrites.add(write);
};

export const removePendingSettingWrite = (write: PendingWrite): void => {
  pendingWrites.delete(write);
};

/** Commits every deferred write and waits for Roam to apply it; a commit only starts the update. */
export const flushPendingSettingWrites = async (): Promise<void> => {
  // Snapshot first, so a commit that schedules more work is not run twice.
  const writes = Array.from(pendingWrites);
  pendingWrites.clear();
  await Promise.all(writes.map((write) => write()));
  await settleTrackedRoamWrites();
};

export const countPendingSettingWrites = (): number => pendingWrites.size;
