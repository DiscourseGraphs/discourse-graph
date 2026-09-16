import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assetDescriptorUrl,
  fetchAsset,
  fetchAssetDescriptor,
} from "../fetchRoamAsset";

const ASSET_URL =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FlqP2ioVNC3.png?alt=media&token=9f1c07a4-2b3e-4c5d-8a91-6e0f2d7b4c13";

const UPLOADED_NAME = "CleanShot 2025-11-16 at 17.14.44@2x.png";

/** A descriptor as Firebase returns it, with Roam's custom metadata. */
const descriptorWithName = {
  name: "imgs/app/MAPLab/lqP2ioVNC3.png",
  contentType: "image/png",
  size: "20480",
  md5Hash: "2+a5zmgB4cXuTfCAbtPGJQ==",
  timeCreated: "2026-06-12T14:00:00.000Z",
  updated: "2026-06-12T14:00:00.000Z",
  metadata: { "file-type": "image/png", "file-name": UPLOADED_NAME },
};

const descriptorWithoutName = {
  name: "imgs/app/MAPLab/GVfB6XBcMR.pdf",
  contentType: "application/pdf",
  size: "51200",
};

/** Answers the descriptor request with JSON. Bytes never travel over `fetch` now. */
const mockFetch = ({
  descriptor,
  descriptorStatus = 200,
}: {
  descriptor: unknown;
  descriptorStatus?: number;
}) => {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      calls.push(input);
      return Promise.resolve({
        ok: descriptorStatus === 200,
        status: descriptorStatus,
        json: () => Promise.resolve(descriptor),
      } as unknown as Response);
    }),
  );
  return { calls };
};

/** Stands in for `roamAlphaAPI.file.get`, which is how bytes are read. */
const mockRoamFileGet = (
  result: File | Error = new File(["PNGDATA"], UPLOADED_NAME, {
    type: "image/png",
  }),
) => {
  const get = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  vi.stubGlobal("window", { roamAlphaAPI: { file: { get } } });
  return { get };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assetDescriptorUrl", () => {
  it("removes alt=media so the request returns the descriptor", () => {
    expect(assetDescriptorUrl(ASSET_URL)).not.toContain("alt=media");
  });

  it("keeps the download token, which governs access to both", () => {
    expect(assetDescriptorUrl(ASSET_URL)).toContain(
      "token=9f1c07a4-2b3e-4c5d-8a91-6e0f2d7b4c13",
    );
  });
});

describe("fetchAsset", () => {
  it("returns the bytes, name and type Roam holds", async () => {
    mockRoamFileGet();

    const asset = await fetchAsset(ASSET_URL);

    expect(new TextDecoder().decode(asset.content)).toBe("PNGDATA");
    expect(asset.filename).toBe(UPLOADED_NAME);
    expect(asset.mimetype).toBe("image/png");
  });

  it("asks Roam for the URL exactly as the markdown holds it", async () => {
    const { get } = mockRoamFileGet();

    await fetchAsset(ASSET_URL);

    expect(get).toHaveBeenCalledWith({ url: ASSET_URL });
  });

  it("falls back to a generic type when Roam reports none", async () => {
    mockRoamFileGet(new File(["DATA"], "notes.unknown"));

    await expect(fetchAsset(ASSET_URL)).resolves.toMatchObject({
      mimetype: "application/octet-stream",
    });
  });

  it("does not read the descriptor", async () => {
    const { calls } = mockFetch({ descriptor: descriptorWithName });
    mockRoamFileGet();

    await fetchAsset(ASSET_URL);

    expect(calls).toEqual([]);
  });

  it("names the asset when Roam refuses to read it", async () => {
    mockRoamFileGet(new Error("Encrypted graph key unavailable"));

    await expect(fetchAsset(ASSET_URL)).rejects.toThrow(
      /Could not fetch asset.*Encrypted graph key unavailable/s,
    );
  });
});

describe("fetchAssetDescriptor", () => {
  it("reports the size and the storage timestamps", async () => {
    mockFetch({ descriptor: descriptorWithName });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toEqual({
      filename: UPLOADED_NAME,
      size: 20480,
      createdAt: new Date("2026-06-12T14:00:00.000Z"),
      modifiedAt: new Date("2026-06-12T14:00:00.000Z"),
    });
  });

  it("reports no name when Roam recorded none, rather than inventing one", async () => {
    // The uid fallback belongs to `file.get`, which resolves the name we actually store.
    // A descriptor name is only ever a label for an asset we decline to download.
    mockFetch({ descriptor: descriptorWithoutName });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toMatchObject({
      filename: undefined,
    });
  });

  it("reports no timestamps when the descriptor carries none", async () => {
    mockFetch({ descriptor: descriptorWithoutName });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toMatchObject({
      createdAt: undefined,
      modifiedAt: undefined,
    });
  });

  it("reports no size when the descriptor sends null rather than omitting it", async () => {
    mockFetch({ descriptor: { ...descriptorWithoutName, size: null } });

    // Not 0: `Number(null)` would read as an empty file and wave the asset past the
    // pre-download cap check.
    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toMatchObject({
      size: undefined,
    });
  });

  it("reports no size when the descriptor sends an empty string", async () => {
    mockFetch({ descriptor: { ...descriptorWithoutName, size: "" } });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toMatchObject({
      size: undefined,
    });
  });

  it("reports no size when the descriptor does not give one", async () => {
    mockFetch({ descriptor: { name: "imgs/app/MAPLab/lqP2ioVNC3.png" } });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toMatchObject({
      size: undefined,
    });
  });

  it("does not transfer the bytes", async () => {
    const { calls } = mockFetch({ descriptor: descriptorWithName });

    await fetchAssetDescriptor(ASSET_URL);

    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain("alt=media");
  });

  it("throws when the descriptor cannot be read", async () => {
    mockFetch({ descriptor: {}, descriptorStatus: 404 });

    await expect(fetchAssetDescriptor(ASSET_URL)).rejects.toThrow(
      /Could not read asset descriptor \(404\)/,
    );
  });
});
