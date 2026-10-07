import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TFile } from "obsidian";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type DiscourseGraphPlugin from "~/index";
import {
  fetchRelationInstancesForImport,
  importRelationsForImportedNodes,
  type RemoteRelationInstance,
} from "~/utils/importRelations";
import { addRelationNoCheck } from "~/utils/relationsStore";

vi.mock("~/utils/relationsStore", () => ({
  loadRelations: vi.fn(() => Promise.resolve({ relations: {} })),
  addRelationNoCheck: vi.fn(() => Promise.resolve()),
  findRelationBySourceDestinationType: vi.fn(() => undefined),
  resolveEndpointToFile: (
    _plugin: unknown,
    endpointId: string,
    files: Map<string, TFile>,
  ) => files.get(endpointId) ?? null,
}));

vi.mock("~/utils/sourceTriple", () => ({
  fetchSourceTripleRids: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock("~/utils/importNodes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/utils/importNodes")>()),
  getSpaceInfoFromIds: vi.fn((_client: unknown, ids: number[]) =>
    Promise.resolve(
      new Map(ids.map((id) => [id, { url: SPACE_URIS[id], name: `${id}` }])),
    ),
  ),
}));

// Vault C imported X from space A and Y from space B; space D created the relation.
const A = 1;
const B = 2;
const C = 3;
const D = 4;
const SPACE_URIS: Record<number, string> = {
  [A]: "obsidian:space-a",
  [B]: "obsidian:space-b",
  [D]: "obsidian:space-d",
};
const X_RID = "orn:obsidian.note:space-a/x";
const Y_RID = "orn:obsidian.note:space-b/y";
const RELATION_TYPE_SCHEMA_ID = 40;

type QueryCall = { method: string; args: unknown[] }[];

// A Supabase query builder stand-in: records the chain and answers from `respond`.
const createClient = (respond: (calls: QueryCall) => unknown) => {
  const queries: QueryCall[] = [];
  const from = () => {
    const calls: QueryCall = [];
    queries.push(calls);
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "neq", "in", "overlaps"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args });
        return builder;
      };
    }
    builder.maybeSingle = () => Promise.resolve(respond(calls));
    builder.then = (resolve: (value: unknown) => unknown) =>
      resolve(respond(calls));
    return builder;
  };
  return { client: { from } as unknown as DGSupabaseClient, queries };
};

const hasCall = (calls: QueryCall, method: string, ...args: unknown[]) =>
  calls.some(
    (call) =>
      call.method === method &&
      JSON.stringify(call.args) === JSON.stringify(args),
  );

const relation = (
  id: number,
  overrides: Partial<RemoteRelationInstance> = {},
): RemoteRelationInstance => ({
  id,
  space_id: D,
  source_local_id: `rel-${id}`,
  schema_id: RELATION_TYPE_SCHEMA_ID,
  reference_content: { source: 50, destination: 60 },
  refs: [50, 60],
  created: null,
  last_modified: null,
  author_id: null,
  concepts_of_relation: [
    { id: 50, space_id: A, source_local_id: "x", schema_id: 10 },
    { id: 60, space_id: B, source_local_id: "y", schema_id: 20 },
  ],
  ...overrides,
});

const file = (path: string) => ({ path }) as TFile;

const createPlugin = (contents: Map<TFile, string>) =>
  ({
    settings: {
      relationTypes: [
        { id: "local-supports", label: "supports", complement: "" },
      ],
      discourseRelations: [],
    },
    saveSettings: vi.fn(() => Promise.resolve()),
    app: {
      vault: { read: (f: TFile) => Promise.resolve(contents.get(f) ?? "") },
    },
  }) as unknown as DiscourseGraphPlugin;

describe("importRelationsForImportedNodes", () => {
  beforeEach(() => {
    vi.mocked(addRelationNoCheck).mockClear();
  });

  const setup = () => {
    const xFile = file("import/a/X.md");
    const yFile = file("import/b/Y.md");
    const plugin = createPlugin(
      new Map([
        [xFile, "---\nnodeTypeId: c-claim\n---\nX"],
        [yFile, "---\nnodeTypeId: c-evidence\n---\nY"],
      ]),
    );
    const { client, queries } = createClient((calls) => {
      if (hasCall(calls, "eq", "is_schema", true)) {
        return {
          data: hasCall(calls, "eq", "space_id", D)
            ? { name: "supports", literal_content: { label: "supports" } }
            : null,
        };
      }
      return {
        data: [{ id: RELATION_TYPE_SCHEMA_ID, source_local_id: "d-supports" }],
      };
    });
    return {
      plugin,
      client,
      queries,
      keyToRelationEndpointId: new Map([
        [`${A}:x`, X_RID],
        [`${B}:y`, Y_RID],
      ]),
      importedFiles: new Map([
        [X_RID, xFile],
        [Y_RID, yFile],
      ]),
    };
  };

  it("imports a relation from a third space with this vault's end types", async () => {
    const { plugin, client, queries, keyToRelationEndpointId, importedFiles } =
      setup();

    const result = await importRelationsForImportedNodes({
      plugin,
      client,
      relationInstances: [relation(100)],
      keyToRelationEndpointId,
      importedFiles,
    });

    expect(result).toEqual({ imported: 1, failed: 0 });
    expect(queries.some((calls) => hasCall(calls, "eq", "space_id", D))).toBe(
      true,
    );
    expect(plugin.settings.discourseRelations).toMatchObject([
      {
        sourceId: "c-claim",
        destinationId: "c-evidence",
        relationshipTypeId: "local-supports",
      },
    ]);
    expect(addRelationNoCheck).toHaveBeenCalledWith(
      plugin,
      expect.objectContaining({
        type: "local-supports",
        source: X_RID,
        destination: Y_RID,
        importedFromRid: "orn:obsidian.relation:space-d/rel-100",
      }),
    );
  });

  it("skips and counts a relation whose end has no local file, and imports the others", async () => {
    const { plugin, client, keyToRelationEndpointId, importedFiles } = setup();
    const zRid = "orn:obsidian.note:space-b/z";
    keyToRelationEndpointId.set(`${B}:z`, zRid);

    const result = await importRelationsForImportedNodes({
      plugin,
      client,
      relationInstances: [
        relation(101, {
          reference_content: { source: 50, destination: 70 },
          concepts_of_relation: [
            { id: 50, space_id: A, source_local_id: "x", schema_id: 10 },
            { id: 70, space_id: B, source_local_id: "z", schema_id: 20 },
          ],
        }),
        relation(100),
      ],
      keyToRelationEndpointId,
      importedFiles,
    });

    expect(result).toEqual({ imported: 1, failed: 1 });
    expect(addRelationNoCheck).toHaveBeenCalledTimes(1);
  });
});

describe("fetchRelationInstancesForImport", () => {
  it("merges the per-space and by-node fetches without duplicates", async () => {
    const { client, queries } = createClient((calls) => ({
      data: hasCall(calls, "overlaps", "refs", [50])
        ? [relation(100), relation(101)]
        : [relation(100, { space_id: A })],
    }));

    const relations = await fetchRelationInstancesForImport({
      client,
      localSpaceId: C,
      spaceIds: [A],
      nodeConceptIds: [50],
    });

    expect(relations.map((rel) => rel.id).sort()).toEqual([100, 101]);
    expect(queries).toHaveLength(2);
  });

  it("leaves out the local space's own relations", async () => {
    const { client, queries } = createClient(() => ({ data: [] }));

    await fetchRelationInstancesForImport({
      client,
      localSpaceId: C,
      spaceIds: [],
      nodeConceptIds: [50],
    });

    expect(hasCall(queries[0]!, "neq", "space_id", C)).toBe(true);
  });
});
