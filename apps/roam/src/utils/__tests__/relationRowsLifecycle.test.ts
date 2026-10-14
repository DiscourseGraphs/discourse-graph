// @vitest-environment jsdom
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRelationRows } from "~/components/useRelationRows";
import {
  loadRelationRows,
  type RelationRow,
} from "~/components/relationsPageData";

vi.mock("~/components/relationsPageData", () => ({
  loadRelationRows: vi.fn(),
}));
const load = vi.mocked(loadRelationRows);
type PullWatch = (pattern: string, entity: string, changed: () => void) => void;
const addPullWatch = vi.fn<PullWatch>();
const removePullWatch = vi.fn<PullWatch>();
const onRowsLoaded = vi.fn();
let root: Root;
let result: ReturnType<typeof useRelationRows>;
const Harness = ({ pageUid = "storage" }: { pageUid?: string }): null => {
  result = useRelationRows({ pageUid, onRowsLoaded });
  return null;
};
const render = async (pageUid = "storage"): Promise<void> => {
  await act(async () => {
    root.render(React.createElement(Harness, { pageUid }));
    await Promise.resolve();
  });
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  Object.assign(window, {
    roamAlphaAPI: { data: { addPullWatch, removePullWatch } },
  });
  load.mockResolvedValue([]);
  root = createRoot(document.createElement("div"));
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("relations page subscription", () => {
  it("coalesces relation edits and releases its watch and pending refresh on unmount", async () => {
    await render();
    const [pattern, entity, changed] = addPullWatch.mock.calls[0];
    changed();
    changed();
    changed();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });
    expect(load).toHaveBeenCalledTimes(2);
    changed();
    act(() => {
      root.unmount();
    });
    expect(removePullWatch).toHaveBeenCalledWith(pattern, entity, changed);
    await vi.advanceTimersByTimeAsync(150);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it("ignores an old load after switching pages", async () => {
    let resolveOld: (rows: RelationRow[]) => void = () => {};
    load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    await render("old-page");
    await render("new-page");
    const fresh = result.rows;
    await act(async () => {
      resolveOld([{ uid: "old-relation" } as RelationRow]);
      await Promise.resolve();
    });
    expect(result.rows).toBe(fresh);
    expect(onRowsLoaded).toHaveBeenCalledTimes(1);
    expect(removePullWatch.mock.calls[0][1]).toBe('[:block/uid "old-page"]');
  });
  it("keeps loaded rows on failure, restores storage, then recovers on refresh", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = [{ uid: "relation" } as RelationRow];
    load.mockResolvedValueOnce(rows);
    await render();
    load.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      result.refresh();
      await Promise.resolve();
    });
    expect(result.error).toBe(true);
    expect(result.rows).toBe(rows);
    expect(onRowsLoaded).toHaveBeenLastCalledWith(null);
    await act(async () => {
      result.refresh();
      await Promise.resolve();
    });
    expect(result.error).toBe(false);
    expect(result.rows).toEqual([]);
    expect(onRowsLoaded).toHaveBeenLastCalledWith([]);
  });
});
