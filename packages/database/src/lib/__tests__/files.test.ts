import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "../client";
import { addFile } from "../files";

type Result = {
  data?: unknown;
  error: { code?: string; message: string } | null;
};

const thenable = (result: Result) => ({
  then: (
    resolve: (value: Result) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject),
});

type Row = {
  source_local_id?: unknown;
  space_id?: unknown;
  filepath?: unknown;
  filehash?: unknown;
  source_path?: unknown;
};

/**
 * A FileReference table whose insert rejects a repeated (source_local_id, space_id,
 * filepath) with 23505, the way the real primary key does, so the duplicate-key branch
 * of addFile is exercised rather than simulated.
 */
const makeClient = () => {
  const rows = new Map<string, Row>();
  const key = ({ source_local_id, space_id, filepath }: Row) =>
    [source_local_id, space_id, filepath].join(" ");

  const upload = vi.fn().mockResolvedValue({ error: null });

  const insert = vi.fn((row: Row) => {
    if (rows.has(key(row)))
      return thenable({ error: { code: "23505", message: "duplicate key" } });
    rows.set(key(row), { ...row });
    return thenable({ error: null });
  });

  const update = vi.fn((patch: Row) => {
    const match: Row = {};
    const builder = {
      eq: vi.fn((column: keyof Row, value: unknown) => {
        match[column] = value;
        return builder;
      }),
      then: (
        resolve: (value: Result) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => {
        const existing = rows.get(key(match));
        if (existing) Object.assign(existing, patch);
        return Promise.resolve({ error: null } as Result).then(resolve, reject);
      },
    };
    return builder;
  });

  const client = {
    rpc: vi.fn((_fn: string, { hashvalue }: { hashvalue: string }) =>
      Promise.resolve({
        data: [...rows.values()].some((row) => row.filehash === hashvalue),
        error: null,
      }),
    ),
    storage: { from: vi.fn(() => ({ upload })) },
    from: vi.fn(() => ({ insert, update })),
  } as unknown as DGSupabaseClient;

  return { client, rows, upload, insert, update };
};

const publish = ({
  client,
  sourcePath,
  body = "bytes",
  fname = "https://firebasestorage.example/imgs/app/graph/lqp2ioVNC3.png",
}: {
  client: DGSupabaseClient;
  sourcePath?: string | null;
  body?: string;
  fname?: string;
}) =>
  addFile({
    client,
    spaceId: 20,
    sourceLocalId: "node-1",
    fname,
    sourcePath,
    mimetype: "image/png",
    created: new Date("2026-09-01T10:00:00Z"),
    lastModified: new Date("2026-09-01T10:00:00Z"),
    content: new TextEncoder().encode(body).buffer,
  });

describe("addFile", () => {
  let harness: ReturnType<typeof makeClient>;

  beforeEach(() => {
    harness = makeClient();
  });

  it("stores the source path on the inserted reference", async () => {
    await publish({ client: harness.client, sourcePath: "diagram.png" });

    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({ source_path: "diagram.png" }),
    ]);
  });

  it("updates the stored name when the same reference is republished under a changed name", async () => {
    await publish({ client: harness.client, sourcePath: "diagram.png" });
    await publish({ client: harness.client, sourcePath: "figure-2.png" });

    expect(harness.update).toHaveBeenCalledWith(
      expect.objectContaining({ source_path: "figure-2.png" }),
    );
    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({ source_path: "figure-2.png" }),
    ]);
  });

  it("clears the stored source path when a republish supplies null", async () => {
    await publish({ client: harness.client, sourcePath: "diagram.png" });
    await publish({ client: harness.client, sourcePath: null });

    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({ source_path: null }),
    ]);
  });

  it("does not clear the stored source path when a republish omits it", async () => {
    await publish({ client: harness.client, sourcePath: "diagram.png" });
    await publish({ client: harness.client });

    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({ source_path: "diagram.png" }),
    ]);
  });

  it("records no name for a caller that does not supply one", async () => {
    await publish({ client: harness.client });

    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({ source_path: null }),
    ]);
  });

  it("returns the content hash of the bytes it stored", async () => {
    const hash = await publish({ client: harness.client, sourcePath: "d.png" });

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect([...harness.rows.values()]).toEqual([
      expect.objectContaining({ filehash: hash }),
    ]);
  });

  it("uploads the bytes once when two references share content", async () => {
    await publish({ client: harness.client, sourcePath: "diagram.png" });
    await publish({
      client: harness.client,
      sourcePath: "same-bytes.png",
      fname: "https://firebasestorage.example/imgs/app/graph/OtherUid00.png",
    });

    expect(harness.upload).toHaveBeenCalledTimes(1);
    expect(harness.rows.size).toBe(2);
  });
});
