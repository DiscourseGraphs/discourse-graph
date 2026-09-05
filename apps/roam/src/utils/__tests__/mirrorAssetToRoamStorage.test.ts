import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { MAX_IMPORTED_ASSET_BYTES } from "@repo/database/lib/assetLimits";
import {
  extractUploadedUrl,
  mirrorAssetToRoamStorage,
  mirroredAssetFileName,
} from "../mirrorAssetToRoamStorage";
import { readMirroredAssetUrl, recordMirroredAsset } from "../assetRegistry";

vi.mock("../assetRegistry", () => ({
  readMirroredAssetUrl: vi.fn(),
  recordMirroredAsset: vi.fn(),
}));

const HASH = "a".repeat(64);
const UPLOADED_URL =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FZr4mWpN70c.png?alt=media&token=9f1c07a4";

/**
 * A stand-in for the registry that behaves like graph props: what is recorded is what a
 * later read returns, so a second call for the same hash sees the first call's upload.
 */
const useInMemoryRegistry = () => {
  const entries = new Map<string, string>();
  vi.mocked(readMirroredAssetUrl).mockImplementation((hash) =>
    entries.get(hash),
  );
  vi.mocked(recordMirroredAsset).mockImplementation(({ contentHash, url }) => {
    entries.set(contentHash, url);
    return Promise.resolve();
  });
  return entries;
};

const makeClient = ({
  size = 1024,
  contentType = "image/png",
}: { size?: number; contentType?: string } = {}) => {
  const blob = new Blob([new Uint8Array(size)], { type: contentType });
  const info = vi.fn().mockResolvedValue({
    data: { size, contentType },
    error: null,
  });
  const download = vi.fn().mockResolvedValue({ data: blob, error: null });
  const client = {
    storage: { from: vi.fn(() => ({ info, download })) },
  } as unknown as DGSupabaseClient;
  return { client, info, download };
};

/** The suite runs in node, so `window` is stubbed the way the other Roam tests stub it. */
const setRoamUpload = (upload: ReturnType<typeof vi.fn>): void => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: { file: { upload } },
  };
};

const mockUpload = (returnValue: string) => {
  const upload = vi.fn().mockResolvedValue(returnValue);
  setRoamUpload(upload);
  return upload;
};

beforeEach(() => {
  useInMemoryRegistry();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("extractUploadedUrl", () => {
  // `file.upload` returns a media-type-dependent block string, not a URL.
  it.each([
    ["an image", `![](${UPLOADED_URL})`],
    ["an image with alt text", `![diagram](${UPLOADED_URL})`],
    ["a pdf", `{{[[pdf]]: ${UPLOADED_URL}}}`],
    ["audio", `{{[[audio]]: ${UPLOADED_URL}}}`],
    ["video", `{{[[video]]: ${UPLOADED_URL}}}`],
    ["anything else, as a bare URL", UPLOADED_URL],
    ["a media embed written without brackets", `{{pdf: ${UPLOADED_URL}}}`],
  ])("unwraps %s", (_label, uploadReturn) => {
    expect(extractUploadedUrl(uploadReturn)).toBe(UPLOADED_URL);
  });

  it("reports a shape it cannot read rather than guessing a URL", () => {
    expect(
      extractUploadedUrl("{{[[roam/render]]: something}}"),
    ).toBeUndefined();
    expect(extractUploadedUrl("")).toBeUndefined();
    // A URL embedded in prose is not an upload result, so it is not taken.
    expect(
      extractUploadedUrl(`see ${UPLOADED_URL} for details`),
    ).toBeUndefined();
  });
});

describe("mirroredAssetFileName", () => {
  it("carries the hash, so a lost registry can be rebuilt from the file's own name", () => {
    expect(
      mirroredAssetFileName({ contentHash: HASH, sourcePath: "diagram.png" }),
    ).toBe(`imported-${HASH}.png`);
  });

  it("falls back to the mime subtype when the recorded name has no extension", () => {
    expect(
      mirroredAssetFileName({
        contentHash: HASH,
        sourcePath: "scan",
        mimetype: "application/pdf",
      }),
    ).toBe(`imported-${HASH}.pdf`);
  });

  it("takes the extension from a recorded name that is a path", () => {
    expect(
      mirroredAssetFileName({
        contentHash: HASH,
        sourcePath: "attachments/notes/report.docx",
      }),
    ).toBe(`imported-${HASH}.docx`);
  });

  it("invents no extension when neither source has one", () => {
    expect(mirroredAssetFileName({ contentHash: HASH })).toBe(
      `imported-${HASH}`,
    );
    expect(
      mirroredAssetFileName({ contentHash: HASH, mimetype: "image/svg+xml" }),
    ).toBe(`imported-${HASH}.svg`);
  });
});

describe("mirrorAssetToRoamStorage", () => {
  it("uploads the bytes and records the URL against the hash", async () => {
    const { client } = makeClient();
    const upload = mockUpload(`![](${UPLOADED_URL})`);

    const result = await mirrorAssetToRoamStorage({
      client,
      contentHash: HASH,
      sourcePath: "diagram.png",
    });

    expect(result).toEqual({
      status: "mirrored",
      contentHash: HASH,
      url: UPLOADED_URL,
    });
    expect(upload).toHaveBeenCalledTimes(1);
    const uploaded = upload.mock.calls[0]?.[0] as { file: File };
    expect(uploaded.file.name).toBe(`imported-${HASH}.png`);
    expect(recordMirroredAsset).toHaveBeenCalledWith({
      contentHash: HASH,
      url: UPLOADED_URL,
    });
  });

  it("uploads once for the same hash, however many nodes reference it", async () => {
    const { client, download } = makeClient();
    const upload = mockUpload(`![](${UPLOADED_URL})`);

    const first = await mirrorAssetToRoamStorage({ client, contentHash: HASH });
    const second = await mirrorAssetToRoamStorage({
      client,
      contentHash: HASH,
    });

    expect(first.status).toBe("mirrored");
    expect(second).toEqual({
      status: "reused",
      contentHash: HASH,
      url: UPLOADED_URL,
    });
    expect(upload).toHaveBeenCalledTimes(1);
    // The reused branch costs no network at all, not merely no upload.
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("records the URL only after the upload returns", async () => {
    const { client } = makeClient();
    const order: string[] = [];
    const upload = vi.fn().mockImplementation(() => {
      order.push("upload");
      return Promise.resolve(`![](${UPLOADED_URL})`);
    });
    setRoamUpload(upload);
    vi.mocked(recordMirroredAsset).mockImplementation(() => {
      order.push("record");
      return Promise.resolve();
    });

    await mirrorAssetToRoamStorage({ client, contentHash: HASH });

    expect(order).toEqual(["upload", "record"]);
  });

  it("skips an asset at or above the cap, reading the size before downloading it", async () => {
    const { client, download } = makeClient({ size: MAX_IMPORTED_ASSET_BYTES });
    const upload = mockUpload(`![](${UPLOADED_URL})`);

    const result = await mirrorAssetToRoamStorage({
      client,
      contentHash: HASH,
    });

    expect(result).toEqual({
      status: "skipped",
      contentHash: HASH,
      reason: "too-large",
      size: MAX_IMPORTED_ASSET_BYTES,
      limit: MAX_IMPORTED_ASSET_BYTES,
    });
    // The cap exists to keep these bytes off the wire, so the skip has to precede both.
    expect(download).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
    expect(recordMirroredAsset).not.toHaveBeenCalled();
  });

  it("skips an oversized asset whose metadata omits its size", async () => {
    const { client, info } = makeClient({ size: MAX_IMPORTED_ASSET_BYTES + 1 });
    const upload = mockUpload(`![](${UPLOADED_URL})`);
    // Roam-origin objects predate the metadata this reads, so the size can be absent.
    info.mockResolvedValue({ data: { contentType: "image/png" }, error: null });

    const result = await mirrorAssetToRoamStorage({
      client,
      contentHash: HASH,
    });

    expect(result).toMatchObject({ status: "skipped", reason: "too-large" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("reports an unreadable upload result rather than recording a wrong URL", async () => {
    const { client } = makeClient();
    mockUpload("{{[[roam/render]]: something}}");

    await expect(
      mirrorAssetToRoamStorage({ client, contentHash: HASH }),
    ).rejects.toThrow(/cannot read a URL from/);
    expect(recordMirroredAsset).not.toHaveBeenCalled();
  });

  it("records nothing when the bytes cannot be downloaded", async () => {
    const { client, download } = makeClient();
    const upload = mockUpload(`![](${UPLOADED_URL})`);
    download.mockResolvedValue({ data: null, error: new Error("not found") });

    await expect(
      mirrorAssetToRoamStorage({ client, contentHash: HASH }),
    ).rejects.toThrow();
    expect(upload).not.toHaveBeenCalled();
    expect(recordMirroredAsset).not.toHaveBeenCalled();
  });
});
