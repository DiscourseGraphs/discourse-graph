import { beforeEach, describe, expect, it, vi } from "vitest";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import deleteQuery from "~/utils/deleteQuery";

vi.mock("roamjs-components/writes/deleteBlock", () => ({ default: vi.fn() }));

const mockedDeleteBlock = vi.mocked(deleteBlock);
const deletePage = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedDeleteBlock.mockResolvedValue("query-uid");
  deletePage.mockResolvedValue(undefined);
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: { deletePage },
  };
});

describe("deleteQuery", () => {
  it("deletes a block-backed query with deleteBlock", async () => {
    await expect(
      deleteQuery({ uid: "query-uid", parentType: "block" }),
    ).resolves.toBe("query-uid");

    expect(mockedDeleteBlock).toHaveBeenCalledWith("query-uid");
    expect(deletePage).not.toHaveBeenCalled();
  });

  it("deletes a page-backed query with deletePage", async () => {
    await expect(
      deleteQuery({ uid: "query-uid", parentType: "page" }),
    ).resolves.toBe("query-uid");

    expect(deletePage).toHaveBeenCalledWith({ page: { uid: "query-uid" } });
    expect(mockedDeleteBlock).not.toHaveBeenCalled();
  });
});
