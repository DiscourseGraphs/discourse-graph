import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { deleteRelationSchema } from "~/utils/deleteRelationSchema";
import {
  isRelationSchemaDeleted,
  subscribeToRelationSchemaChanges,
} from "~/utils/relationSchemaChanges";

const mocks = vi.hoisted(() => ({
  deleteBlock: vi.fn(),
  setSetting: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("roamjs-components/writes/deleteBlock", () => ({
  default: mocks.deleteBlock,
}));
vi.mock("~/components/settings/utils/accessors", () => ({
  getGlobalSettings: () => ({
    Relations: { deleted: { label: "supports" }, kept: { label: "opposes" } },
  }),
  setGlobalSetting: mocks.setSetting,
}));
vi.mock("~/utils/refreshConfigTree", () => ({ default: mocks.refresh }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

it("blocks creation immediately after deletion and waits for configuration refresh", async () => {
  const listener = vi.fn();
  const unsubscribe = subscribeToRelationSchemaChanges(listener);
  try {
    const finished = vi.fn();
    const pending = deleteRelationSchema("deleted").then(finished);
    await Promise.resolve();
    expect(isRelationSchemaDeleted("deleted")).toBe(true);
    expect(listener).toHaveBeenCalledOnce();
    expect(mocks.setSetting).toHaveBeenCalledWith(["Relations"], {
      kept: { label: "opposes" },
    });
    expect(finished).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    await pending;
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(finished).toHaveBeenCalledOnce();
  } finally {
    unsubscribe();
  }
});
it("propagates a failed block deletion without disabling the schema", async () => {
  mocks.deleteBlock.mockRejectedValueOnce(new Error("delete failed"));
  await expect(deleteRelationSchema("failed-delete")).rejects.toThrow(
    "delete failed",
  );
  expect(isRelationSchemaDeleted("failed-delete")).toBe(false);
  expect(mocks.setSetting).not.toHaveBeenCalled();
});
it("propagates setting failures while keeping the deleted schema unavailable", async () => {
  mocks.setSetting.mockImplementationOnce(() => {
    throw new Error("settings failed");
  });
  await expect(deleteRelationSchema("failed-settings")).rejects.toThrow(
    "settings failed",
  );
  expect(isRelationSchemaDeleted("failed-settings")).toBe(true);
});
it("propagates configuration refresh failures to the caller", async () => {
  mocks.refresh.mockImplementationOnce(() => {
    throw new Error("refresh failed");
  });
  const pending = expect(
    deleteRelationSchema("failed-refresh"),
  ).rejects.toThrow("refresh failed");
  await vi.runAllTimersAsync();
  await pending;
  expect(isRelationSchemaDeleted("failed-refresh")).toBe(true);
});
