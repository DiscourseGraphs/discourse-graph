import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { createDiscourseNodeType } from "~/components/settings/utils/accessors";
import getDiscourseNodes, {
  type DiscourseNode,
} from "~/utils/getDiscourseNodes";
import internalError from "~/utils/internalError";
import { resolveSharedNodeTypes } from "~/utils/resolveSharedNodeTypes";

vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("~/components/settings/utils/accessors", () => ({
  createDiscourseNodeType: vi.fn(),
}));
vi.mock("~/utils/getDiscourseNodes", () => ({
  default: vi.fn(),
  excludeDefaultNodes: (node: DiscourseNode) => node.backedBy !== "default",
}));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));

const mockedCreateDiscourseNodeType = vi.mocked(createDiscourseNodeType);
const mockedGetDiscourseNodes = vi.mocked(getDiscourseNodes);
const mockedInternalError = vi.mocked(internalError);

const SCHEMA_ID = 200;
const REMOTE_TYPE_UID = "node_hs6r0kqxvbmc3l9ywtd2fp";
const FORMAT = "[[EVD]] - {content}";

const evidenceType: DiscourseNode = {
  text: "Evidence",
  type: "local-evd-uid",
  shortcut: "E",
  format: FORMAT,
  specification: [],
  backedBy: "user",
  canvasSettings: {},
};

const pageType: DiscourseNode = {
  text: "Page",
  type: "page-node",
  shortcut: "p",
  format: "{content}",
  specification: [],
  backedBy: "default",
  canvasSettings: {},
};

const sharedNode: SharedNode = {
  rid: "orn:obsidian.note:vault-a/node-1",
  sourceLocalId: "node-1",
  schemaId: SCHEMA_ID,
  spaceId: 20,
  spaceName: "Research vault",
  spaceUri: "obsidian:vault-a",
  platform: "Obsidian",
  title: "EVD - REM sleep and recall",
  coreTitle: "REM sleep and recall",
  created: "2026-06-14T12:30:00.000Z",
  lastModified: "2026-06-14T15:00:00.000Z",
  authorId: 7,
  directMetadata: null,
};

type SchemaRow = {
  id: number;
  name: string | null;
  source_local_id: string | null;
  format: string | null;
  source_data_format: string | null;
};

const schemaRow = (overrides: Partial<SchemaRow> = {}): SchemaRow => ({
  id: SCHEMA_ID,
  name: "Evidence",
  source_local_id: REMOTE_TYPE_UID,
  format: FORMAT,
  source_data_format: null,
  ...overrides,
});

const makeClient = ({
  rows = [schemaRow()],
  error = null,
}: {
  rows?: SchemaRow[];
  error?: { message: string } | null;
} = {}) => {
  const result = { data: error ? null : rows, error };
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    then: (
      resolve: (value: typeof result) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  const from = vi.fn().mockReturnValue(builder);
  return { client: { from } as unknown as DGSupabaseClient, builder, from };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedGetDiscourseNodes.mockReturnValue([]);
});

describe("resolveSharedNodeTypes", () => {
  it("matches the local node type carrying the published type id", async () => {
    const { client, builder } = makeClient();
    const importedType = { ...evidenceType, type: REMOTE_TYPE_UID };
    mockedGetDiscourseNodes.mockReturnValue([
      { ...evidenceType, text: "Other name" },
      importedType,
    ]);

    await expect(
      resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] }),
    ).resolves.toEqual(new Map([[sharedNode.rid, importedType]]));
    expect(builder.eq).toHaveBeenCalledWith("is_schema", true);
    expect(builder.eq).toHaveBeenCalledWith("is_relation", false);
    expect(builder.in).toHaveBeenCalledWith("id", [SCHEMA_ID]);
    expect(mockedCreateDiscourseNodeType).not.toHaveBeenCalled();
  });

  it("matches the local node type by name when no id matches", async () => {
    const { client } = makeClient();
    mockedGetDiscourseNodes.mockReturnValue([evidenceType]);

    await expect(
      resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] }),
    ).resolves.toEqual(new Map([[sharedNode.rid, evidenceType]]));
    expect(mockedCreateDiscourseNodeType).not.toHaveBeenCalled();
  });

  it("creates a local node type reusing the remote id and format", async () => {
    const { client } = makeClient();
    const createdType = { ...evidenceType, type: REMOTE_TYPE_UID };
    mockedCreateDiscourseNodeType.mockResolvedValue(createdType);

    await expect(
      resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] }),
    ).resolves.toEqual(new Map([[sharedNode.rid, createdType]]));
    expect(mockedCreateDiscourseNodeType).toHaveBeenCalledWith({
      text: "Evidence",
      shortcut: "",
      format: FORMAT,
      uid: REMOTE_TYPE_UID,
    });
  });

  it("reads the format Obsidian nests under source_data", async () => {
    const { client } = makeClient({
      rows: [
        schemaRow({
          format: null,
          source_data_format: "[[EVD]] - {content} - {Source}",
        }),
      ],
    });
    mockedCreateDiscourseNodeType.mockResolvedValue(evidenceType);

    await resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] });

    expect(mockedCreateDiscourseNodeType).toHaveBeenCalledWith(
      expect.objectContaining({ format: "[[EVD]] - {content} - {Source}" }),
    );
  });

  it("creates a formatless node type from a schema published before formats", async () => {
    const { client } = makeClient({ rows: [schemaRow({ format: null })] });
    mockedCreateDiscourseNodeType.mockResolvedValue(evidenceType);

    await resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] });

    expect(mockedCreateDiscourseNodeType).toHaveBeenCalledWith(
      expect.objectContaining({ format: "" }),
    );
  });

  it("never matches the default Page and Block types", async () => {
    const { client } = makeClient({
      rows: [schemaRow({ name: "Page", source_local_id: "page-node" })],
    });
    mockedGetDiscourseNodes.mockReturnValue([pageType]);
    mockedCreateDiscourseNodeType.mockResolvedValue(evidenceType);

    await resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] });

    expect(mockedCreateDiscourseNodeType).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Page", uid: "page-node" }),
    );
  });

  it("leaves out a node whose schema row is not visible", async () => {
    const { client } = makeClient({ rows: [] });

    await expect(
      resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] }),
    ).resolves.toEqual(new Map());
    expect(mockedCreateDiscourseNodeType).not.toHaveBeenCalled();
  });

  it("fetches every node type schema in one query", async () => {
    const { client, builder, from } = makeClient({
      rows: [schemaRow(), schemaRow({ id: 300, name: "Claim" })],
    });
    mockedGetDiscourseNodes.mockReturnValue([evidenceType]);
    mockedCreateDiscourseNodeType.mockResolvedValue(evidenceType);

    await resolveSharedNodeTypes({
      client,
      sharedNodes: [
        sharedNode,
        { ...sharedNode, rid: "orn:obsidian.note:vault-a/node-2" },
        {
          ...sharedNode,
          rid: "orn:obsidian.note:vault-a/node-3",
          schemaId: 300,
        },
      ],
    });

    expect(from).toHaveBeenCalledTimes(1);
    expect(builder.in).toHaveBeenCalledWith("id", [SCHEMA_ID, 300]);
  });

  it("reports a failed type creation and leaves the node undecorated", async () => {
    const { client } = makeClient();
    mockedCreateDiscourseNodeType.mockRejectedValue(
      new Error("page create failed"),
    );

    await expect(
      resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] }),
    ).resolves.toEqual(new Map());
    expect(mockedInternalError).toHaveBeenCalledWith(
      expect.objectContaining({ sendEmail: false }),
    );
  });

  it("reports a failed schema query and leaves every node undecorated", async () => {
    const { client } = makeClient({ error: { message: "permission denied" } });

    await expect(
      resolveSharedNodeTypes({ client, sharedNodes: [sharedNode] }),
    ).resolves.toEqual(new Map());
    expect(mockedInternalError).toHaveBeenCalledWith(
      expect.objectContaining({ sendEmail: false }),
    );
    expect(mockedCreateDiscourseNodeType).not.toHaveBeenCalled();
  });
});
