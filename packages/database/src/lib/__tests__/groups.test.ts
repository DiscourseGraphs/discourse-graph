import { describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "../client";
import { getPublishedGroupIdsByRid } from "../groups";

type Row = Record<string, unknown>;

const readPath = (row: Row, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Row)[key] : undefined,
      row,
    );

// Applies `.in()` and `.not(…, "is", null)` like PostgREST; records `.in()` calls.
const makeClient = (tables: Record<string, Row[]>) => {
  const inCalls: { table: string; column: string; values: unknown[] }[] = [];
  const from = vi.fn((table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    const builder = {
      select: vi.fn(() => builder),
      in: vi.fn((column: string, values: unknown[]) => {
        inCalls.push({ table, column, values });
        filters.push((row) => values.includes(readPath(row, column)));
        return builder;
      }),
      not: vi.fn((column: string) => {
        filters.push((row) => readPath(row, column) != null);
        return builder;
      }),
      then: (
        resolve: (value: { data: Row[]; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve({
          data: (tables[table] ?? []).filter((row) =>
            filters.every((filter) => filter(row)),
          ),
          error: null,
        }).then(resolve, reject),
    };
    return builder;
  });
  return { client: { from } as unknown as DGSupabaseClient, from, inCalls };
};

const G1 = "group-1";
const G2 = "group-2";
const obsidianUrl = "obsidian:vault-a";
const roamUrl = "https://roamresearch.com/#/app/graph-b";
const obsidianRid = "orn:obsidian.note:vault-a/node-1";
const roamRid = `${roamUrl}/uid-1`;

const obsidianSpace = { spaceId: 20, url: obsidianUrl };
const roamSpace = { spaceId: 30, url: roamUrl };

const sharing = ({
  space,
  groupId,
  permissions,
}: {
  space: { spaceId: number; url: string };
  groupId: string;
  permissions: string | null;
}): Row => ({
  space_id: space.spaceId,
  group_id: groupId,
  sharing_permissions: permissions,
  Space: { url: space.url },
});

const grant = ({
  groupId,
  space,
  sourceLocalId,
}: {
  groupId: string;
  space: { spaceId: number };
  sourceLocalId: string;
}): Row => ({
  account_uid: groupId,
  space_id: space.spaceId,
  source_local_id: sourceLocalId,
});

describe("getPublishedGroupIdsByRid", () => {
  it("returns only the group the node is published to under partial space access", async () => {
    const { client } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: obsidianSpace, groupId: G1, permissions: "partial" }),
        sharing({ space: obsidianSpace, groupId: G2, permissions: "partial" }),
      ],
      ResourceAccess: [
        grant({ groupId: G1, space: obsidianSpace, sourceLocalId: "node-1" }),
        grant({ groupId: G2, space: obsidianSpace, sourceLocalId: "node-2" }),
      ],
    });

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [obsidianRid] }),
    ).resolves.toEqual({ [obsidianRid]: [G1] });
  });

  it("returns every group the node is published to", async () => {
    const { client } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: roamSpace, groupId: G1, permissions: "partial" }),
        sharing({ space: roamSpace, groupId: G2, permissions: "partial" }),
      ],
      ResourceAccess: [
        grant({ groupId: G1, space: roamSpace, sourceLocalId: "uid-1" }),
        grant({ groupId: G2, space: roamSpace, sourceLocalId: "uid-1" }),
      ],
    });

    const result = await getPublishedGroupIdsByRid({ client, rids: [roamRid] });

    expect(result[roamRid]?.sort()).toEqual([G1, G2]);
  });

  it("returns no groups for a node published to none of them", async () => {
    const { client } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: obsidianSpace, groupId: G1, permissions: "partial" }),
      ],
      ResourceAccess: [
        grant({ groupId: G1, space: obsidianSpace, sourceLocalId: "node-2" }),
      ],
    });

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [obsidianRid] }),
    ).resolves.toEqual({ [obsidianRid]: [] });
  });

  it("counts a group with reader access to the space without a ResourceAccess grant", async () => {
    const { client, from } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: obsidianSpace, groupId: G1, permissions: "reader" }),
      ],
    });

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [obsidianRid] }),
    ).resolves.toEqual({ [obsidianRid]: [G1] });
    expect(from).not.toHaveBeenCalledWith("ResourceAccess");
  });

  it("ignores a group the space belongs to but is not shared with", async () => {
    const { client } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: obsidianSpace, groupId: G1, permissions: "partial" }),
        sharing({ space: obsidianSpace, groupId: G2, permissions: null }),
      ],
      ResourceAccess: [
        grant({ groupId: G1, space: obsidianSpace, sourceLocalId: "node-1" }),
        grant({ groupId: G2, space: obsidianSpace, sourceLocalId: "node-1" }),
      ],
    });

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [obsidianRid] }),
    ).resolves.toEqual({ [obsidianRid]: [G1] });
  });

  it("matches grants on both the space and the local id", async () => {
    const { client } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: obsidianSpace, groupId: G1, permissions: "partial" }),
        sharing({ space: roamSpace, groupId: G2, permissions: "partial" }),
      ],
      ResourceAccess: [
        grant({ groupId: G1, space: obsidianSpace, sourceLocalId: "node-1" }),
        // Same local id as the Obsidian node, in the other space.
        grant({ groupId: G2, space: roamSpace, sourceLocalId: "node-1" }),
        grant({ groupId: G2, space: roamSpace, sourceLocalId: "uid-1" }),
      ],
    });

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [obsidianRid, roamRid] }),
    ).resolves.toEqual({ [obsidianRid]: [G1], [roamRid]: [G2] });
  });

  it("returns no groups for a node whose space is not shared with the user's groups", async () => {
    const { client, from } = makeClient({ my_pseudo_accounts: [] });

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [obsidianRid] }),
    ).resolves.toEqual({ [obsidianRid]: [] });
    expect(from).not.toHaveBeenCalledWith("ResourceAccess");
  });

  it("queries local ids from all spaces in shared batches", async () => {
    const localIds = Array.from({ length: 30 }, (_, i) => `node-${i}`);
    const rids = [
      ...localIds.map((id) => `orn:obsidian.note:vault-a/${id}`),
      ...localIds.map((id) => `${roamUrl}/uid-${id}`),
    ];
    const { client, inCalls } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: obsidianSpace, groupId: G1, permissions: "partial" }),
        sharing({ space: roamSpace, groupId: G1, permissions: "partial" }),
      ],
    });

    await getPublishedGroupIdsByRid({ client, rids });

    expect(
      inCalls
        .filter(({ column }) => column === "source_local_id")
        .map(({ values }) => values.length),
    ).toEqual([50, 10]);
  });

  it("shrinks batches so local ids × partial groups stay under max_rows", async () => {
    const groupIds = Array.from({ length: 30 }, (_, i) => `group-${i}`);
    const localIds = Array.from({ length: 100 }, (_, i) => `node-${i}`);
    const { client, inCalls } = makeClient({
      my_pseudo_accounts: groupIds.map((groupId) =>
        sharing({ space: obsidianSpace, groupId, permissions: "partial" }),
      ),
      ResourceAccess: localIds.flatMap((sourceLocalId) =>
        groupIds.map((groupId) =>
          grant({ groupId, space: obsidianSpace, sourceLocalId }),
        ),
      ),
    });

    const result = await getPublishedGroupIdsByRid({
      client,
      rids: localIds.map((id) => `orn:obsidian.note:vault-a/${id}`),
    });

    expect(
      inCalls
        .filter(({ column }) => column === "source_local_id")
        .map(({ values }) => values.length),
    ).toEqual([33, 33, 33, 1]);
    expect(result["orn:obsidian.note:vault-a/node-99"]).toEqual(groupIds);
  });

  it("lists a group once for a rid repeated across batches", async () => {
    const rids = Array.from(
      { length: 60 },
      (_, i) => `orn:obsidian.note:vault-a/node-${i}`,
    );
    rids[55] = obsidianRid;
    const { client } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: obsidianSpace, groupId: G1, permissions: "partial" }),
      ],
      ResourceAccess: [
        grant({ groupId: G1, space: obsidianSpace, sourceLocalId: "node-1" }),
      ],
    });

    const result = await getPublishedGroupIdsByRid({ client, rids });

    expect(result[obsidianRid]).toEqual([G1]);
  });

  it("counts a grant only for a group with partial access to that space", async () => {
    const G3 = "group-3";
    const { client } = makeClient({
      my_pseudo_accounts: [
        sharing({ space: obsidianSpace, groupId: G1, permissions: "reader" }),
        sharing({ space: roamSpace, groupId: G1, permissions: "partial" }),
        sharing({ space: roamSpace, groupId: G3, permissions: "partial" }),
      ],
      ResourceAccess: [
        // G1 already reads the whole Obsidian space.
        grant({ groupId: G1, space: obsidianSpace, sourceLocalId: "node-1" }),
        // G3 is not shared with the Obsidian space.
        grant({ groupId: G3, space: obsidianSpace, sourceLocalId: "node-1" }),
        grant({ groupId: G3, space: roamSpace, sourceLocalId: "uid-1" }),
      ],
    });

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [obsidianRid, roamRid] }),
    ).resolves.toEqual({ [obsidianRid]: [G1], [roamRid]: [G3] });
  });

  it("skips the database when there are no rids", async () => {
    const { client, from } = makeClient({});

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [] }),
    ).resolves.toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it("throws the query error", async () => {
    const error = { message: "boom" };
    const builder = {
      select: vi.fn(() => builder),
      in: vi.fn(() => builder),
      not: vi.fn(() => builder),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve({ data: null, error }).then(resolve),
    };
    const client = {
      from: vi.fn(() => builder),
    } as unknown as DGSupabaseClient;

    await expect(
      getPublishedGroupIdsByRid({ client, rids: [obsidianRid] }),
    ).rejects.toEqual(error);
  });
});
