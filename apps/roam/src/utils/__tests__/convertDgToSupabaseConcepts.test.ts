import { afterEach, describe, expect, it, vi } from "vitest";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import type { SupabaseContext } from "~/utils/supabaseContext";

vi.mock("~/utils/getDiscourseNodes", () => ({ default: () => [] }));
vi.mock("~/utils/internalError", () => ({ default: vi.fn() }));
vi.mock("posthog-js", () => ({ default: { capture: vi.fn() } }));
vi.mock("~/components/settings/utils/accessors", () => ({
  isSyncEnabled: () => true,
}));
vi.mock("~/utils/getAllDiscourseNodesSince", () => ({
  getAllDiscourseNodesSince: vi.fn(),
  nodeTypeSince: (_since: number | undefined, nodeTypes: DiscourseNode[]) =>
    Promise.resolve(nodeTypes),
}));
vi.mock("~/utils/conceptConversion", () => ({
  discourseNodeSchemaToLocalConcept: (
    _context: SupabaseContext,
    node: DiscourseNode,
  ): LocalConceptDataInput => ({
    source_local_id: node.type,
    name: node.text,
    is_schema: true,
  }),
  orderConceptsByDependency: (concepts: LocalConceptDataInput[]) => ({
    ordered: concepts,
    missing: [],
  }),
}));

import { convertDgToSupabaseConcepts } from "~/utils/syncDgNodesToSupabase";

const claimType: DiscourseNode = {
  type: "claim-type",
  text: "Claim",
  shortcut: "C",
  specification: [],
  backedBy: "user",
  canvasSettings: {},
  format: "[[CLM]] - {content}",
};

const context = { spaceId: 20, userId: 7 } as SupabaseContext;

const makeClient = () => {
  const rpc = vi.fn().mockResolvedValue({ data: [1], error: null });
  return { rpc, client: { rpc } as unknown as DGSupabaseClient };
};

describe("convertDgToSupabaseConcepts node types", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends each node type's Content inside its schema Concept", async () => {
    vi.stubGlobal("window", {
      roamAlphaAPI: {
        data: {
          backend: {
            q: () =>
              Promise.resolve([
                {
                  source_local_id: "claim-type",
                  created: 1000,
                  last_modified: 2000,
                  author_local_id: "user-1",
                  text: "discourse-graph/nodes/Claim",
                  author_name: "User",
                },
              ]),
          },
        },
      },
    });
    const { rpc, client } = makeClient();

    await convertDgToSupabaseConcepts({
      nodesSince: [],
      since: undefined,
      allNodeTypes: [claimType],
      supabaseClient: client,
      context,
    });

    expect(rpc.mock.calls.map(([fn]) => fn as string)).toEqual([
      "upsert_concepts",
    ]);
    const [, { data }] = rpc.mock.calls[0] as [
      string,
      { data: LocalConceptDataInput[] },
    ];
    expect(data).toEqual([
      expect.objectContaining({
        source_local_id: "claim-type",
        is_schema: true,
        contents_inline: [
          expect.objectContaining({
            source_local_id: "claim-type",
            text: "discourse-graph/nodes/Claim",
            variant: "direct",
            author_local_id: "user-1",
          }),
        ],
      }),
    ]);
  });
});
