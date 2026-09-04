import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assetDescriptorUrl,
  fetchAssetBytes,
  fetchAssetDescriptor,
} from "../fetchRoamAsset";

const ASSET_URL =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FlqP2ioVNC3.png?alt=media&token=9f1c07a4-2b3e-4c5d-8a91-6e0f2d7b4c13";

/** A descriptor as Firebase returns it, with Roam's custom metadata. */
const descriptorWithName = {
  name: "imgs/app/MAPLab/lqP2ioVNC3.png",
  contentType: "image/png",
  size: "20480",
  md5Hash: "2+a5zmgB4cXuTfCAbtPGJQ==",
  metadata: {
    "file-type": "image/png",
    "file-name": "CleanShot 2025-11-16 at 17.14.44@2x.png",
  },
};

const descriptorWithoutName = {
  name: "imgs/app/MAPLab/GVfB6XBcMR.pdf",
  contentType: "application/pdf",
  size: "51200",
};

/** Answers the descriptor request with JSON and the bytes request with a body. */
const mockFetch = ({
  descriptor,
  bytes = "PNGDATA",
  descriptorStatus = 200,
  bytesStatus = 200,
}: {
  descriptor: unknown;
  bytes?: string;
  descriptorStatus?: number;
  bytesStatus?: number;
}) => {
  const calls: string[] = [];
  const fetchMock = vi.fn((input: string) => {
    calls.push(input);
    const isDescriptor = !input.includes("alt=media");
    if (isDescriptor)
      return Promise.resolve({
        ok: descriptorStatus === 200,
        status: descriptorStatus,
        json: () => Promise.resolve(descriptor),
      } as unknown as Response);
    return Promise.resolve({
      ok: bytesStatus === 200,
      status: bytesStatus,
      arrayBuffer: () =>
        Promise.resolve(new TextEncoder().encode(bytes).buffer),
    } as unknown as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
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

describe("fetchAssetDescriptor", () => {
  it("resolves the uploaded name when Roam recorded one", async () => {
    mockFetch({ descriptor: descriptorWithName });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toEqual({
      filename: "CleanShot 2025-11-16 at 17.14.44@2x.png",
      mimetype: "image/png",
      size: 20480,
    });
  });

  it("falls back to the storage uid when the name key is absent", async () => {
    mockFetch({ descriptor: descriptorWithoutName });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toEqual({
      filename: "GVfB6XBcMR.pdf",
      mimetype: "application/pdf",
      size: 51200,
    });
  });

  it("falls back to the storage uid when there is no metadata at all", async () => {
    mockFetch({ descriptor: { name: "imgs/app/MAPLab/lqP2ioVNC3.png" } });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toMatchObject({
      filename: "lqP2ioVNC3.png",
      mimetype: "application/octet-stream",
    });
  });

  it("falls back to the uid in the URL when the descriptor names no object", async () => {
    mockFetch({ descriptor: { contentType: "image/png" } });

    await expect(fetchAssetDescriptor(ASSET_URL)).resolves.toMatchObject({
      filename: "lqP2ioVNC3.png",
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

describe("fetchAssetBytes", () => {
  it("downloads the bytes, without reading the descriptor", async () => {
    const { calls } = mockFetch({
      descriptor: descriptorWithName,
      bytes: "PNGDATA",
    });

    const content = await fetchAssetBytes(ASSET_URL);

    expect(new TextDecoder().decode(content)).toBe("PNGDATA");
    expect(calls).toEqual([ASSET_URL]);
  });

  it("throws when the bytes cannot be fetched", async () => {
    mockFetch({ descriptor: descriptorWithName, bytesStatus: 403 });

    await expect(fetchAssetBytes(ASSET_URL)).rejects.toThrow(
      /Could not fetch asset \(403\)/,
    );
  });
});
