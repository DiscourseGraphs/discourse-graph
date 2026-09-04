import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { contentTypes } from "@repo/content-model";
import { MAX_PUBLISHED_ASSET_BYTES } from "@repo/database/lib/assetLimits";
import { publishNodeAssets } from "../publishNodeAssets";

const IMAGE =
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
const makeClient = () => {
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

  const client = {
    rpc: vi.fn((_fn: string, { hashvalue }: { hashvalue: string }) =>
      Promise.resolve({
        data: rows.some((row) => row.filehash === hashvalue),
        error: null,
      }),
    ),
    storage: { from: vi.fn(() => ({ upload })) },
    from: vi.fn(() => ({
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
    })),
  } as unknown as DGSupabaseClient;
  return {
    client,
    rows,
    upload,
    filepaths: () => rows.map((r) => r.filepath),
    selectCount: () => selects.length,
    deleteCount: () => deletes.length,
    failReferenceRead: (message: string) => {
      selectError = { message };
    },
  };
};

const nodeWith = (markdown: string): CrossAppNode => ({
  localId: "tgWb6JozF",
  nodeType: "rCLM0schema",
  coreTitle: "Sleep improves memory consolidation",
  content: {
    direct: { value: "Sleep improves memory consolidation" },
    full: { contentType: contentTypes.markdown, value: markdown },
  },
  createdAt: new Date("2026-06-12T14:00:00.000Z"),
  modifiedAt: new Date("2026-06-12T15:00:00.000Z"),
  authorId: "maparent",
});

const MARKDOWN = `# Sleep improves memory consolidation\n\n![](${IMAGE})\n\n- Supported by [[EVD]] - Rasch & Born 2013\n`;

const mockFetch = ({
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
    vi.fn((input: string) => {
      if (!input.includes("alt=media"))
        return Promise.resolve({
          ok: descriptorOk,
          status: descriptorOk ? 200 : 500,
          json: () =>
            Promise.resolve({
              name: "imgs/app/MAPLab/lqP2ioVNC3.png",
              contentType: "image/png",
              size: String(size),
              metadata: { "file-name": "diagram.png" },
            }),
        } as unknown as Response);
      return Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () =>
          Promise.resolve(new TextEncoder().encode(bytes).buffer),
      } as unknown as Response);
    }),
  );
};

describe("publishNodeAssets", () => {
  let harness: ReturnType<typeof makeClient>;

  beforeEach(() => {
    harness = makeClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records a reference whose filepath is the URL from the markdown", async () => {
    mockFetch({});
    const node = nodeWith(MARKDOWN);

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(results).toEqual([
      {
        status: "copied",
        sourceRef: IMAGE,
        sourceLocalId: "tgWb6JozF",
        contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
        sourcePath: "diagram.png",
      },
    ]);
    expect(harness.filepaths()).toEqual([IMAGE]);
  });

  it("leaves the published markdown untouched", async () => {
    mockFetch({});
    const node = nodeWith(MARKDOWN);

    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(node.content.full?.value).toBe(MARKDOWN);
  });

  it("publishes a node with no assets without recording anything", async () => {
    mockFetch({});
    const node = nodeWith("# A title\n\nJust prose.\n");

    await expect(
      publishNodeAssets({
        client: harness.client,
        spaceId: 20,
        nodes: [node],
      }),
    ).resolves.toEqual([]);
    expect(harness.rows).toHaveLength(0);
  });

  it("skips a node with no full content", async () => {
    mockFetch({});
    const node = nodeWith(MARKDOWN);
    delete node.content.full;

    await expect(
      publishNodeAssets({
        client: harness.client,
        spaceId: 20,
        nodes: [node],
      }),
    ).resolves.toEqual([]);
  });

  it("carries an unfetchable asset out as a failure instead of throwing", async () => {
    mockFetch({ descriptorOk: false });
    const node = nodeWith(MARKDOWN);

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(results).toEqual([
      {
        status: "failed",
        sourceRef: IMAGE,
        sourceLocalId: "tgWb6JozF",
        error: expect.stringContaining(
          "Could not read asset descriptor",
        ) as unknown,
      },
    ]);
    expect(node.content.full?.value).toBe(MARKDOWN);
  });

  it("carries an over-cap asset out as a skip", async () => {
    mockFetch({ size: MAX_PUBLISHED_ASSET_BYTES + 1 });
    const node = nodeWith(MARKDOWN);

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(results[0]).toMatchObject({
      status: "skipped",
      reason: "too-large",
      sourceLocalId: "tgWb6JozF",
    });
    expect(harness.rows).toHaveLength(0);
  });

  it("attributes each asset to the node that references it", async () => {
    mockFetch({});
    const first = nodeWith(MARKDOWN);
    const second = { ...nodeWith(MARKDOWN), localId: "otherNode" };

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [first, second],
    });

    expect(results.map((r) => r.sourceLocalId)).toEqual([
      "tgWb6JozF",
      "otherNode",
    ]);
  });

  it("re-publishing an unchanged node fetches nothing and records nothing new", async () => {
    mockFetch({});
    const node = nodeWith(MARKDOWN);
    const publish = () =>
      publishNodeAssets({ client: harness.client, spaceId: 20, nodes: [node] });

    await publish();
    const fetchesAfterFirst = vi.mocked(fetch).mock.calls.length;

    const results = await publish();

    expect(vi.mocked(fetch).mock.calls).toHaveLength(fetchesAfterFirst);
    expect(results).toEqual([
      {
        status: "unchanged",
        sourceRef: IMAGE,
        sourceLocalId: "tgWb6JozF",
        contentHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown,
        sourcePath: "diagram.png",
      },
    ]);
    expect(harness.filepaths()).toEqual([IMAGE]);
  });

  it("drops the reference to an asset the node no longer embeds", async () => {
    mockFetch({});
    const node = nodeWith(MARKDOWN);

    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });
    expect(harness.filepaths()).toEqual([IMAGE]);

    const withoutImage = nodeWith("# A title\n\nThe image is gone.\n");
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [withoutImage],
    });

    expect(harness.rows).toHaveLength(0);
  });

  it("leaves another node's references alone when cleaning up", async () => {
    mockFetch({});
    const other = { ...nodeWith(MARKDOWN), localId: "otherNode" };

    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [other],
    });
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [nodeWith("# A title\n\nNo assets here.\n")],
    });

    expect(harness.rows).toEqual([
      expect.objectContaining({
        source_local_id: "otherNode",
        filepath: IMAGE,
      }),
    ]);
  });

  it("reads every node's references in one query", async () => {
    mockFetch({});
    const nodes = ["n1", "n2", "n3"].map((localId) => ({
      ...nodeWith(MARKDOWN),
      localId,
    }));

    await publishNodeAssets({ client: harness.client, spaceId: 20, nodes });

    expect(harness.selectCount()).toBe(1);
  });

  it("issues no delete when the node has nothing stale to drop", async () => {
    mockFetch({});
    const node = nodeWith(MARKDOWN);

    // A first publish, then an unchanged re-publish: neither has a stale reference.
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(harness.deleteCount()).toBe(0);
  });

  it("replaces the reference when Roam rotates the download token", async () => {
    mockFetch({});
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [nodeWith(MARKDOWN)],
    });

    // The token is part of the URL, so a rotation reads as a different reference.
    const rotated = `${IMAGE.split("&token=")[0]}&token=rotated`;
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [nodeWith(MARKDOWN.replace(IMAGE, rotated))],
    });

    expect(harness.filepaths()).toEqual([rotated]);
  });

  it("keeps a still-referenced row when the node's references cannot be read", async () => {
    mockFetch({});
    const node = nodeWith(MARKDOWN);
    await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    harness.failReferenceRead("offline");

    const results = await publishNodeAssets({
      client: harness.client,
      spaceId: 20,
      nodes: [node],
    });

    expect(results[0]).toMatchObject({ status: "failed", error: "offline" });
    expect(harness.filepaths()).toEqual([IMAGE]);
  });
});
