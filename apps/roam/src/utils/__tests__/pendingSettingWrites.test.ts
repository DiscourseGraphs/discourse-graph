import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  addPendingSettingWrite,
  removePendingSettingWrite,
  flushPendingSettingWrites,
  countPendingSettingWrites,
} from "~/utils/pendingSettingWrites";
import { setBlockPropsAsync } from "~/utils/setBlockProps";

describe("pending setting writes", () => {
  beforeEach(async () => {
    await flushPendingSettingWrites();
  });

  it("commits every registered write on flush", async () => {
    const first = vi.fn();
    const second = vi.fn();
    addPendingSettingWrite(first);
    addPendingSettingWrite(second);

    await flushPendingSettingWrites();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("drains the registry so a second flush is a no-op", async () => {
    const write = vi.fn();
    addPendingSettingWrite(write);

    await flushPendingSettingWrites();
    await flushPendingSettingWrites();

    expect(write).toHaveBeenCalledTimes(1);
    expect(countPendingSettingWrites()).toBe(0);
  });

  it("does not commit a write that was already removed", async () => {
    const write = vi.fn();
    addPendingSettingWrite(write);
    removePendingSettingWrite(write);

    await flushPendingSettingWrites();

    expect(write).not.toHaveBeenCalled();
  });

  // A panel's commit removes its own registration as it runs; that must not make
  // the in-progress flush skip or double-run anything.
  it("tolerates a write that deregisters itself while committing", async () => {
    const selfRemoving = vi.fn(() => removePendingSettingWrite(selfRemoving));
    const other = vi.fn();
    addPendingSettingWrite(selfRemoving);
    addPendingSettingWrite(other);

    await flushPendingSettingWrites();

    expect(selfRemoving).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenCalledTimes(1);
  });

  it("keeps a write registered by a commit for the next flush", async () => {
    const followUp = vi.fn();
    const write = vi.fn(() => addPendingSettingWrite(followUp));
    addPendingSettingWrite(write);

    await flushPendingSettingWrites();
    expect(followUp).not.toHaveBeenCalled();

    await flushPendingSettingWrites();
    expect(followUp).toHaveBeenCalledTimes(1);
  });

  // The whole point of awaiting the flush: a commit only *starts* a Roam block
  // update, so a caller reading straight after a synchronous flush could still
  // observe the previous value.
  it("waits for the Roam write a commit starts", async () => {
    let applied = false;
    let resolveUpdate = (): void => undefined;
    const update = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveUpdate = () => {
            applied = true;
            resolve();
          };
        }),
    );
    vi.stubGlobal("window", {
      roamAlphaAPI: { pull: () => ({}), data: { block: { update } } },
    });

    addPendingSettingWrite(() => {
      void setBlockPropsAsync("block-uid", { Trigger: "@@" });
    });

    const flushed = flushPendingSettingWrites();
    // Resolve on a later turn so a flush that failed to await would have settled.
    setTimeout(resolveUpdate, 0);
    await flushed;

    expect(update).toHaveBeenCalledTimes(1);
    expect(applied).toBe(true);
    vi.unstubAllGlobals();
  });
});
