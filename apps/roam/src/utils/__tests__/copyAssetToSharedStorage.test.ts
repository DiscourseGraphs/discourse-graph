import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { MAX_ASSET_BYTES } from "@repo/database/lib/assetLimits";
import {
  copyAssetToSharedStorage,
  type SkippedAsset,
} from "../copyAssetToSharedStorage";

const asset = (uid: string) =>
  `https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2F${uid}?alt=media&token=9f1c07a4`;

const IMAGE = asset("lqP2ioVNC3.png");
const OTHER = asset("Zr4mWpN70c.png");

type Row = { filepath?: unknown; filehash?: unknown; source_path?: unknown };

/**
 * A stand-in for Supabase that behaves like the real one where this code depends on it:
 * `file_exists` answers from the rows already written, and the primary key rejects a
 * repeated reference.
 */
const makeClient = () => {
  const rows = new Map<string, Row>();
  const upload = vi.fn().mockResolvedValue({ error: null });
  const thenable = (result: unknown) => ({
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  });
  const client = {
    rpc: vi.fn((_fn: string, { hashvalue }: { hashvalue: string }) =>
      Promise.resolve({
        data: [...rows.values()].some((row) => row.filehash === hashvalue),
        error: null,
      }),
    ),
    storage: { from: vi.fn(() => ({ upload })) },
    from: vi.fn(() => ({
      insert: vi.fn((row: Row) => {
        if (rows.has(String(row.filepath)))
          return thenable({ error: { code: "23505", message: "duplicate" } });
        rows.set(String(row.filepath), { ...row });
        return thenable({ error: null });
      }),
      update: vi.fn(() => {
        const builder = {
          eq: vi.fn(() => builder),
          then: thenable({ error: null }).then,
        };
        return builder;
      }),
    })),
  } as unknown as DGSupabaseClient;
  return { client, rows, upload };
};

const DESCRIPTOR_NAME = "descriptor-name.png";
const ROAM_NAME = "CleanShot 2025-11-16 at 17.14.44@2x.png";

const descriptorFor = ({
  size,
  name = DESCRIPTOR_NAME,
}: {
  size?: number;
  name?: string;
}) => ({
  name: "imgs/app/MAPLab/lqP2ioVNC3.png",
  contentType: "image/png",
  ...(size === undefined ? {} : { size: String(size) }),
  timeCreated: "2026-06-12T14:00:00.000Z",
  updated: "2026-06-12T14:00:00.000Z",
  metadata: { "file-name": name },
});

/** The descriptor read. The bytes travel through `file.get`, never through `fetch`. */
const mockFetch = ({ descriptor }: { descriptor: unknown }) => {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      calls.push(input);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(descriptor),
      } as unknown as Response);
    }),
  );
  return { calls };
};

const mockRoam = ({
  bytes,
  name = ROAM_NAME,
  isEncrypted = false,
}: {
  bytes: string;
  name?: string;
  isEncrypted?: boolean;
}) => {
  const get = vi.fn(() =>
    Promise.resolve(new File([bytes], name, { type: "image/png" })),
  );
  vi.stubGlobal("window", {
    roamAlphaAPI: { file: { get }, graph: { isEncrypted } },
  });
  return { get };
};

const copy = (
  client: DGSupabaseClient,
  assetUrl = IMAGE,
): ReturnType<typeof copyAssetToSharedStorage> =>
  copyAssetToSharedStorage({
    client,
    spaceId: 20,
    sourceLocalId: "node-1",
    assetUrl,
    nodeCreated: new Date("2026-06-01T00:00:00.000Z"),
    nodeLastModified: new Date("2026-06-02T00:00:00.000Z"),
  });

describe("copyAssetToSharedStorage", () => {
  let harness: ReturnType<typeof makeClient>;

  beforeEach(() => {
    harness = makeClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records the URL as written, with the name Roam restored", async () => {
    mockFetch({ descriptor: descriptorFor({ size: 7 }) });
    mockRoam({ bytes: "PNGDATA" });

    await expect(copy(harness.client)).resolves.toEqual({
      status: "copied",
      sourceRef: IMAGE,
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
      sourcePath: ROAM_NAME,
    });
    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({ filepath: IMAGE, source_path: ROAM_NAME }),
    ]);
  });

  it("prefers the name from file.get over the one in the descriptor", async () => {
    mockFetch({ descriptor: descriptorFor({ size: 7 }) });
    mockRoam({ bytes: "PNGDATA" });

    const result = await copy(harness.client);

    expect(result.sourcePath).toBe(ROAM_NAME);
    expect(result.sourcePath).not.toBe(DESCRIPTOR_NAME);
  });

  it("stores the storage timestamps, which do not move between publishes", async () => {
    mockFetch({ descriptor: descriptorFor({ size: 7 }) });
    mockRoam({ bytes: "PNGDATA" });

    await copy(harness.client);

    // Not the node's own dates, and never `File.lastModified`, which is the time of the
    // call: the importer rewrites a vault copy whenever the row disagrees with it.
    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({
        created: "2026-06-12T14:00:00.000Z",
        last_modified: "2026-06-12T14:00:00.000Z",
      }),
    ]);
  });

  it("falls back to the node's dates when the descriptor carries no timestamps", async () => {
    mockFetch({ descriptor: { contentType: "image/png", size: "7" } });
    mockRoam({ bytes: "PNGDATA" });

    await copy(harness.client);

    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({
        created: "2026-06-01T00:00:00.000Z",
        last_modified: "2026-06-02T00:00:00.000Z",
      }),
    ]);
  });

  it("stores one copy when the same content is referenced twice", async () => {
    mockFetch({ descriptor: descriptorFor({ size: 7 }) });
    mockRoam({ bytes: "PNGDATA" });

    await copy(harness.client, IMAGE);
    await copy(harness.client, OTHER);

    expect(harness.upload).toHaveBeenCalledTimes(1);
    expect(harness.rows.size).toBe(2);
  });

  it("skips an asset above the cap and reports it, without throwing", async () => {
    const size = MAX_ASSET_BYTES + 1;
    mockFetch({ descriptor: descriptorFor({ size }) });
    mockRoam({ bytes: "unused" });

    await expect(copy(harness.client)).resolves.toEqual({
      status: "skipped",
      sourceRef: IMAGE,
      sourcePath: DESCRIPTOR_NAME,
      reason: "too-large",
      size,
      limit: MAX_ASSET_BYTES,
    });
    expect(harness.rows.size).toBe(0);
    expect(harness.upload).not.toHaveBeenCalled();
  });

  it("does not download the bytes of an asset it will skip", async () => {
    mockFetch({ descriptor: descriptorFor({ size: MAX_ASSET_BYTES }) });
    const { get } = mockRoam({ bytes: "unused" });

    await copy(harness.client);

    expect(get).not.toHaveBeenCalled();
  });

  it("reports no name for a skipped asset Roam recorded none for", async () => {
    mockFetch({ descriptor: { size: String(MAX_ASSET_BYTES) } });
    mockRoam({ bytes: "unused" });

    const result = await copy(harness.client);

    // Asserted directly: both `toEqual` and `toMatchObject` ignore an expected
    // `undefined`, so either would pass against a name invented from the URL.
    expect(result.status).toBe("skipped");
    expect((result as SkippedAsset).sourcePath).toBeUndefined();
  });

  it("skips an over-cap asset whose size the descriptor did not report", async () => {
    mockFetch({ descriptor: descriptorFor({}) });
    mockRoam({ bytes: "x".repeat(MAX_ASSET_BYTES + 1) });

    const result = await copy(harness.client);

    expect(result.status).toBe("skipped");
    expect(harness.rows.size).toBe(0);
  });

  it("copies an asset whose size the descriptor did not report but is under the cap", async () => {
    mockFetch({ descriptor: descriptorFor({}) });
    mockRoam({ bytes: "PNGDATA" });

    const result = await copy(harness.client);

    expect(result.status).toBe("copied");
    expect(harness.rows.size).toBe(1);
  });

  it("ignores the descriptor size on an encrypted graph, where it measures ciphertext", async () => {
    // Encryption inflates the stored object by an unknown factor, so a descriptor over
    // the cap says nothing about the decrypted file the cap is actually about.
    mockFetch({ descriptor: descriptorFor({ size: MAX_ASSET_BYTES + 1 }) });
    mockRoam({ bytes: "PNGDATA", isEncrypted: true });

    const result = await copy(harness.client);

    expect(result.status).toBe("copied");
    expect(harness.rows.size).toBe(1);
  });

  it("still enforces the cap on an encrypted graph, from the decrypted bytes", async () => {
    mockFetch({ descriptor: descriptorFor({ size: 7 }) });
    mockRoam({ bytes: "x".repeat(MAX_ASSET_BYTES), isEncrypted: true });

    const result = await copy(harness.client);

    expect(result.status).toBe("skipped");
    expect(harness.rows.size).toBe(0);
  });
});
