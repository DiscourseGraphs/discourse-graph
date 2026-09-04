import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { MAX_PUBLISHED_ASSET_BYTES } from "@repo/database/lib/assetLimits";
import { copyAssetToSharedStorage } from "../copyAssetToSharedStorage";

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

const descriptorFor = ({
  size,
  name = "CleanShot 2025-11-16 at 17.14.44@2x.png",
}: {
  size?: number;
  name?: string;
}) => ({
  name: "imgs/app/MAPLab/lqP2ioVNC3.png",
  contentType: "image/png",
  ...(size === undefined ? {} : { size: String(size) }),
  timeCreated: "2026-06-12T14:00:00.000Z",
  updated: "2026-06-12T15:00:00.000Z",
  metadata: { "file-name": name },
});

const mockFetch = ({
  descriptor,
  bytes,
}: {
  descriptor: unknown;
  bytes: string;
}) => {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((input: string) => {
      calls.push(input);
      if (!input.includes("alt=media"))
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(descriptor),
        } as unknown as Response);
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(bytes).buffer),
      } as unknown as Response);
    }),
  );
  return { calls };
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

  it("records the URL as written, with the name Roam holds", async () => {
    mockFetch({ descriptor: descriptorFor({ size: 7 }), bytes: "PNGDATA" });

    await expect(copy(harness.client)).resolves.toEqual({
      status: "copied",
      sourceRef: IMAGE,
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
      sourcePath: "CleanShot 2025-11-16 at 17.14.44@2x.png",
    });
    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({
        filepath: IMAGE,
        source_path: "CleanShot 2025-11-16 at 17.14.44@2x.png",
      }),
    ]);
  });

  it("stores one copy when the same content is referenced twice", async () => {
    mockFetch({ descriptor: descriptorFor({ size: 7 }), bytes: "PNGDATA" });

    await copy(harness.client, IMAGE);
    await copy(harness.client, OTHER);

    expect(harness.upload).toHaveBeenCalledTimes(1);
    expect(harness.rows.size).toBe(2);
  });

  it("skips an asset above the cap and reports it, without throwing", async () => {
    const size = MAX_PUBLISHED_ASSET_BYTES + 1;
    mockFetch({ descriptor: descriptorFor({ size }), bytes: "unused" });

    await expect(copy(harness.client)).resolves.toEqual({
      status: "skipped",
      sourceRef: IMAGE,
      sourcePath: "CleanShot 2025-11-16 at 17.14.44@2x.png",
      reason: "too-large",
      size,
      limit: MAX_PUBLISHED_ASSET_BYTES,
    });
    expect(harness.rows.size).toBe(0);
    expect(harness.upload).not.toHaveBeenCalled();
  });

  it("does not download the bytes of an asset it will skip", async () => {
    const { calls } = mockFetch({
      descriptor: descriptorFor({ size: MAX_PUBLISHED_ASSET_BYTES }),
      bytes: "unused",
    });

    await copy(harness.client);

    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toContain("alt=media");
  });

  it("skips an over-cap asset whose size the descriptor did not report", async () => {
    mockFetch({
      descriptor: descriptorFor({}),
      bytes: "x".repeat(MAX_PUBLISHED_ASSET_BYTES + 1),
    });

    const result = await copy(harness.client);

    expect(result.status).toBe("skipped");
    expect(harness.rows.size).toBe(0);
  });

  it("copies an asset whose size the descriptor did not report but is under the cap", async () => {
    mockFetch({ descriptor: descriptorFor({}), bytes: "PNGDATA" });

    const result = await copy(harness.client);

    expect(result.status).toBe("copied");
    expect(harness.rows.size).toBe(1);
  });
});
