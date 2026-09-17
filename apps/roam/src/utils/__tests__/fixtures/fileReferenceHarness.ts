import { vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";

export const IMAGE =
  "https://firebasestorage.googleapis.com/v0/b/firescript-577a2.appspot.com/o/imgs%2Fapp%2FMAPLab%2FlqP2ioVNC3.png?alt=media&token=9f1c07a4";

type Row = {
  space_id?: unknown;
  source_local_id?: unknown;
  filepath?: unknown;
  filehash?: unknown;
  source_path?: unknown;
};

/**
 * A stand-in for Supabase covering what the stage leans on: `my_file_references` answers
 * per node, `file_exists` answers from the rows already written, and a delete honours the
 * `eq`/`notIn` filters so cleanup can be asserted rather than assumed.
 */
export const makeClient = () => {
  const rows: Row[] = [];
  const upload = vi.fn().mockResolvedValue({ error: null });
  const thenable = (result: unknown) => ({
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  });

  type Filter = (row: Row) => boolean;
  const filtered = (filters: Filter[]) =>
    rows.filter((row) => filters.every((f) => f(row)));

  /** Set to make the reference read fail, as an offline client would. */
  let selectError: { message: string } | null = null;

  const selects: number[] = [];
  const deletes: number[] = [];

  const selectBuilder = (filters: Filter[]) => {
    const builder = {
      eq: (column: string, value: unknown) =>
        selectBuilder([
          ...filters,
          (row) => row[column as keyof Row] === value,
        ]),
      in: (column: string, values: unknown[]) =>
        selectBuilder([
          ...filters,
          (row) => values.includes(row[column as keyof Row]),
        ]),
      then: (resolve: (value: unknown) => unknown) => {
        selects.push(1);
        return Promise.resolve(
          selectError
            ? { data: null, error: selectError }
            : { data: filtered(filters), error: null },
        ).then(resolve);
      },
    };
    return builder;
  };

  const deleteBuilder = (filters: Filter[]) => ({
    eq: (column: string, value: unknown) =>
      deleteBuilder([...filters, (row) => row[column as keyof Row] === value]),
    notIn: (column: string, values: unknown[]) =>
      deleteBuilder([
        ...filters,
        (row) => !values.includes(row[column as keyof Row]),
      ]),
    then: (resolve: (value: unknown) => unknown) => {
      deletes.push(1);
      for (const row of filtered(filters)) rows.splice(rows.indexOf(row), 1);
      return Promise.resolve({ error: null }).then(resolve);
    },
  });

  /** Set to make the content upload fail, so what follows it can be asserted. */
  let contentUploadError: { message: string } | null = null;

  const rpc = vi.fn((fn: string, { hashvalue }: { hashvalue?: string }) =>
    Promise.resolve(
      fn === "upsert_content" && contentUploadError
        ? { data: null, error: contentUploadError }
        : { data: rows.some((row) => row.filehash === hashvalue), error: null },
    ),
  );
  const tableOperations = () => ({
    select: vi.fn(() => selectBuilder([])),
    delete: vi.fn(() => deleteBuilder([])),
    insert: vi.fn((row: Row) => {
      rows.push({ ...row });
      return thenable({ error: null });
    }),
    update: vi.fn(() => {
      const builder = {
        eq: vi.fn(() => builder),
        then: thenable({ error: null }).then,
      };
      return builder;
    }),
  });
  // Typed with the table name so a test can assert which table was touched.
  const from =
    vi.fn<(table: string) => ReturnType<typeof tableOperations>>(
      tableOperations,
    );

  const client = {
    rpc,
    storage: { from: vi.fn(() => ({ upload })) },
    from,
  } as unknown as DGSupabaseClient;
  return {
    client,
    rpc,
    from,
    rows,
    upload,
    filepaths: () => rows.map((r) => r.filepath),
    selectCount: () => selects.length,
    deleteCount: () => deletes.length,
    failReferenceRead: (message: string) => {
      selectError = { message };
    },
    failContentUpload: (message: string) => {
      contentUploadError = { message };
    },
  };
};

/**
 * Both reads an asset takes: the descriptor over `fetch`, and the bytes through Roam.
 * Returns Roam's `get` so a test can assert that nothing was transferred.
 */
export const mockAssetReads = ({
  size = 7,
  bytes = "PNGDATA",
  descriptorOk = true,
}: {
  size?: number;
  bytes?: string;
  descriptorOk?: boolean;
}) => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: descriptorOk,
        status: descriptorOk ? 200 : 500,
        json: () =>
          Promise.resolve({
            name: "imgs/app/MAPLab/lqP2ioVNC3.png",
            contentType: "image/png",
            size: String(size),
            metadata: { "file-name": "diagram.png" },
          }),
      } as unknown as Response),
    ),
  );
  const get = vi.fn(() =>
    Promise.resolve(new File([bytes], "diagram.png", { type: "image/png" })),
  );
  vi.stubGlobal("window", {
    roamAlphaAPI: {
      file: { get },
      graph: { name: "MAPLab", isEncrypted: false },
    },
  });
  return { get };
};
