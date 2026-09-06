import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import { DISCOURSE_GRAPH_PROP_NAME } from "~/utils/createReifiedBlock";
import type { json } from "~/utils/getBlockProps";
import {
  ASSET_REGISTRY_BLOCK_TEXT,
  ASSET_REGISTRY_PAGE_TITLE,
  ASSET_REGISTRY_PROP_KEY,
  readAssetRegistry,
  readMirroredAssetUrl,
  recordMirroredAsset,
} from "~/utils/assetRegistry";

vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/queries/getShallowTreeByParentUid", () => ({
  default: vi.fn(),
}));
vi.mock("roamjs-components/writes/createBlock", () => ({ default: vi.fn() }));
vi.mock("roamjs-components/writes/createPage", () => ({ default: vi.fn() }));

const mockedGetPageUidByPageTitle = vi.mocked(getPageUidByPageTitle);
const mockedGetShallowTreeByParentUid = vi.mocked(getShallowTreeByParentUid);
const mockedCreateBlock = vi.mocked(createBlock);
const mockedCreatePage = vi.mocked(createPage);

const PAGE_UID = "registry-page-uid";
const BLOCK_UID = "registry-block-uid";
const HASH = "a".repeat(64);
const OTHER_HASH = "b".repeat(64);
const URL = "https://firebasestorage.googleapis.com/v0/b/x/o/one?alt=media";
const OTHER_URL =
  "https://firebasestorage.googleapis.com/v0/b/x/o/two?alt=media";

const propsByUid = new Map<string, Record<string, json>>();

/**
 * A stand-in for the graph: pages and their children exist only once something has
 * created them, so an absent registry behaves the way a fresh graph does.
 */
const graph = { pages: new Map<string, { uid: string; text: string }[]>() };

const setRoamAlphaApi = (): void => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      data: {
        block: {
          update: ({
            block,
          }: {
            block: { uid: string; props: Record<string, json> };
          }) => {
            propsByUid.set(block.uid, block.props);
            return Promise.resolve();
          },
        },
      },
      pull: (_pattern: string, [, uid]: [string, string]) => ({
        ":block/props": propsByUid.get(uid) ?? {},
      }),
    },
  };
};

const originalWindow = (globalThis as { window?: unknown }).window;

afterEach(() => {
  // Vitest isolates files by default, so this only matters if isolation is turned off or
  // this suite is merged into another; a fake roamAlphaAPI leaking into a file that
  // expects none would fail it far from here.
  (globalThis as { window?: unknown }).window = originalWindow;
  vi.restoreAllMocks();
});

beforeEach(() => {
  propsByUid.clear();
  graph.pages.clear();
  vi.clearAllMocks();
  setRoamAlphaApi();

  mockedGetPageUidByPageTitle.mockImplementation((title: string) =>
    graph.pages.has(title) ? PAGE_UID : "",
  );
  mockedGetShallowTreeByParentUid.mockImplementation((parentUid: string) =>
    parentUid === PAGE_UID
      ? (graph.pages.get(ASSET_REGISTRY_PAGE_TITLE) ?? [])
      : [],
  );
  mockedCreatePage.mockImplementation(({ title }: { title: string }) => {
    graph.pages.set(title, []);
    return Promise.resolve(PAGE_UID);
  });
  mockedCreateBlock.mockImplementation(
    ({ node }: { node: { text?: string } }) => {
      graph.pages
        .get(ASSET_REGISTRY_PAGE_TITLE)
        ?.push({ uid: BLOCK_UID, text: node.text ?? "" });
      return Promise.resolve(BLOCK_UID);
    },
  );
});

describe("asset registry", () => {
  it("returns an empty registry, and creates nothing, when the page is absent", () => {
    expect(readAssetRegistry()).toEqual({});
    expect(readMirroredAssetUrl(HASH)).toBeUndefined();
    expect(mockedCreatePage).not.toHaveBeenCalled();
    expect(mockedCreateBlock).not.toHaveBeenCalled();
  });

  it("creates the page and the named block on the first write", async () => {
    await recordMirroredAsset({ contentHash: HASH, url: URL });

    expect(mockedCreatePage).toHaveBeenCalledWith({
      title: ASSET_REGISTRY_PAGE_TITLE,
    });
    expect(mockedCreateBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        node: { text: ASSET_REGISTRY_BLOCK_TEXT },
        parentUid: PAGE_UID,
      }),
    );
    expect(propsByUid.get(BLOCK_UID)).toEqual({
      [DISCOURSE_GRAPH_PROP_NAME]: {
        [ASSET_REGISTRY_PROP_KEY]: { [HASH]: URL },
      },
    });
  });

  it("reads back what it wrote, accumulating across writes", async () => {
    await recordMirroredAsset({ contentHash: HASH, url: URL });
    await recordMirroredAsset({ contentHash: OTHER_HASH, url: OTHER_URL });

    expect(readAssetRegistry()).toEqual({
      [HASH]: URL,
      [OTHER_HASH]: OTHER_URL,
    });
    expect(readMirroredAssetUrl(OTHER_HASH)).toBe(OTHER_URL);
  });

  it("reuses the existing block rather than creating a second one", async () => {
    await recordMirroredAsset({ contentHash: HASH, url: URL });
    mockedCreatePage.mockClear();
    mockedCreateBlock.mockClear();

    await recordMirroredAsset({ contentHash: OTHER_HASH, url: OTHER_URL });

    expect(mockedCreatePage).not.toHaveBeenCalled();
    expect(mockedCreateBlock).not.toHaveBeenCalled();
  });

  it("leaves unrelated discourse-graph props on the block untouched", async () => {
    graph.pages.set(ASSET_REGISTRY_PAGE_TITLE, [
      { uid: BLOCK_UID, text: ASSET_REGISTRY_BLOCK_TEXT },
    ]);
    propsByUid.set(BLOCK_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: { somethingElse: "keep me" },
    });

    await recordMirroredAsset({ contentHash: HASH, url: URL });

    expect(propsByUid.get(BLOCK_UID)).toEqual({
      [DISCOURSE_GRAPH_PROP_NAME]: {
        somethingElse: "keep me",
        [ASSET_REGISTRY_PROP_KEY]: { [HASH]: URL },
      },
    });
  });

  it("ignores a malformed registry rather than throwing", () => {
    graph.pages.set(ASSET_REGISTRY_PAGE_TITLE, [
      { uid: BLOCK_UID, text: ASSET_REGISTRY_BLOCK_TEXT },
    ]);
    propsByUid.set(BLOCK_UID, {
      [DISCOURSE_GRAPH_PROP_NAME]: {
        [ASSET_REGISTRY_PROP_KEY]: { [HASH]: 7, [OTHER_HASH]: OTHER_URL },
      },
    });

    expect(readAssetRegistry()).toEqual({ [OTHER_HASH]: OTHER_URL });
  });

  it("ignores a block on the page that is not the registry block", () => {
    // A page holding blocks but not the registry block is the orphan condition, so this
    // warns; the warning is asserted below, and only muted here.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    graph.pages.set(ASSET_REGISTRY_PAGE_TITLE, [
      { uid: "other-block", text: "Some note the user wrote" },
    ]);
    propsByUid.set("other-block", {
      [DISCOURSE_GRAPH_PROP_NAME]: {
        [ASSET_REGISTRY_PROP_KEY]: { [HASH]: URL },
      },
    });

    expect(readAssetRegistry()).toEqual({});
  });

  it("warns once when the page outlives its registry block, however many lookups follow", async () => {
    // Established and read back first, so the warning is known to be unspent whatever
    // ran before this test.
    await recordMirroredAsset({ contentHash: HASH, url: URL });
    expect(readAssetRegistry()).toEqual({ [HASH]: URL });

    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    graph.pages.set(ASSET_REGISTRY_PAGE_TITLE, [
      { uid: BLOCK_UID, text: "Sync Asset Registry (renamed)" },
    ]);

    expect(readAssetRegistry()).toEqual({});
    expect(readMirroredAssetUrl(HASH)).toBeUndefined();
    expect(readMirroredAssetUrl(OTHER_HASH)).toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(ASSET_REGISTRY_BLOCK_TEXT),
    );
  });

  it("recreates an orphaned registry block without announcing a future repair", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    graph.pages.set(ASSET_REGISTRY_PAGE_TITLE, [
      { uid: "some-other-block", text: "Sync Asset Registry (renamed)" },
    ]);

    await recordMirroredAsset({ contentHash: HASH, url: URL });

    expect(mockedCreatePage).not.toHaveBeenCalled();
    expect(mockedCreateBlock).toHaveBeenCalledWith(
      expect.objectContaining({ parentUid: PAGE_UID }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("says nothing on a graph that has never imported an asset", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(readAssetRegistry()).toEqual({});
    expect(warn).not.toHaveBeenCalled();
  });
});
