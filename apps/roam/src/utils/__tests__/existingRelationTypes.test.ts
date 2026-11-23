import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTripletForPair,
  deriveRelationTypes,
} from "~/components/canvas/existingRelationTypes";
import { refreshCanvasRelations } from "~/components/canvas/refreshCanvasRelations";
import type { DiscourseRelation } from "~/utils/getDiscourseRelations";

const mocks = vi.hoisted(() => {
  const context: { relations: Record<string, unknown[]> } = { relations: {} };
  return {
    calls: [] as string[],
    relations: [] as DiscourseRelation[],
    provisional: new Set<string>(),
    createRelationSchema: vi.fn(),
    newSettingsStore: false,
    context,
  };
});
vi.mock("~/components/canvas/Tldraw", () => ({
  discourseContext: mocks.context,
}));
vi.mock("~/components/canvas/canvasUtils", () => ({
  getAllRelations: () => Object.values(mocks.context.relations).flat(),
}));
vi.mock("~/components/settings/utils/accessors", () => ({
  isNewSettingsStoreEnabled: () => mocks.newSettingsStore,
}));
vi.mock("~/utils/refreshConfigTree", () => ({
  default: () => mocks.calls.push("refreshConfigTree"),
}));
vi.mock("~/utils/getDiscourseRelations", () => ({
  default: () => mocks.relations,
}));
vi.mock("~/utils/createRelationSchema", () => ({
  createRelationSchema: mocks.createRelationSchema,
}));
vi.mock("~/utils/relationSchemaChanges", () => ({
  notifyRelationSchemaChange: () => mocks.calls.push("notify"),
  isRelationSchemaDeleted: () => false,
  markRelationSchemaDeleted: (id: string) => mocks.calls.push(`deleted:${id}`),
}));
vi.mock("~/utils/relationSchemaAcceptance", () => ({
  isAcceptedRelationSchema: ({ id }: { id: string }) =>
    !mocks.provisional.has(id),
  isProvisionalRelationSchema: (id: string) => mocks.provisional.has(id),
  acceptImportedRelationSchema: (id: string) => {
    mocks.calls.push(`accept:${id}`);
    return Promise.resolve();
  },
}));

const triplet = (
  overrides: Partial<DiscourseRelation> & { id: string },
): DiscourseRelation => ({
  label: "supports",
  complement: "is supported by",
  source: "evidence",
  destination: "claim",
  triples: [],
  ...overrides,
});

beforeEach(() => {
  mocks.calls = [];
  mocks.relations = [];
  mocks.provisional = new Set();
  mocks.context.relations = {};
  mocks.createRelationSchema.mockReset();
  mocks.newSettingsStore = false;
});

describe("deriveRelationTypes", () => {
  it("treats a mirrored label / complement pair as one type, keeping the first-seen reading", () => {
    const types = deriveRelationTypes({
      relations: [
        triplet({ id: "a", label: "Informs", complement: "Informed By" }),
        triplet({ id: "b", label: "Informed By", complement: "Informs" }),
      ],
      pairTypes: [],
    });
    expect(types).toEqual([{ label: "Informs", complement: "Informed By" }]);
  });

  it("groups triplets by label + complement and removes repeated ids", () => {
    const types = deriveRelationTypes({
      relations: [
        triplet({ id: "a" }),
        triplet({ id: "a" }),
        triplet({ id: "b", source: "question" }),
        triplet({ id: "c", complement: "backs" }),
      ],
      pairTypes: [],
    });
    expect(types).toEqual([
      { label: "supports", complement: "is supported by" },
      { label: "supports", complement: "backs" },
    ]);
  });

  it("hides only types the pair already has, in either reading", () => {
    const relations = [
      triplet({ id: "a" }),
      triplet({ id: "b", complement: "backs" }),
      triplet({ id: "c", label: "informs", complement: "supports" }),
      triplet({ id: "d", label: "opposes", complement: "is opposed by" }),
    ];
    expect(
      deriveRelationTypes({
        relations,
        pairTypes: [
          { label: "supports", complement: "is supported by" },
          { label: "is opposed by", complement: "opposes" },
        ],
      }),
    ).toEqual([
      { label: "supports", complement: "backs" },
      { label: "informs", complement: "supports" },
    ]);
  });

  it("leaves out incomplete and provisional triplets", () => {
    mocks.provisional.add("p");
    const types = deriveRelationTypes({
      relations: [
        triplet({ id: "p", label: "provisional" }),
        triplet({ id: "i", label: "incomplete", complement: "" }),
        triplet({ id: "q", label: "placeholder", destination: "?" }),
      ],
      pairTypes: [],
    });
    expect(types).toEqual([]);
  });

  it("includes triplets with Any (*) node types", () => {
    const types = deriveRelationTypes({
      relations: [triplet({ id: "a", source: "*" })],
      pairTypes: [],
    });
    expect(types).toEqual([
      { label: "supports", complement: "is supported by" },
    ]);
  });
});

describe("createTripletForPair", () => {
  const args = {
    label: "supports",
    complement: "is supported by",
    sourceType: "claim",
    destinationType: "evidence",
  };

  it("refreshes the config tree first, saves in drag direction, then refreshes the canvas", async () => {
    mocks.createRelationSchema.mockImplementation(() => {
      mocks.calls.push("create");
      // The settings write lands after the call returns.
      setTimeout(() => mocks.relations.push(triplet({ id: "new-uid" })), 60);
      return Promise.resolve("new-uid");
    });
    await expect(createTripletForPair(args)).resolves.toBe("new-uid");
    expect(mocks.createRelationSchema).toHaveBeenCalledWith({
      label: "supports",
      complement: "is supported by",
      source: "claim",
      destination: "evidence",
    });
    expect(mocks.calls.slice(0, 2)).toEqual(["refreshConfigTree", "create"]);
    expect(mocks.calls.at(-1)).toBe("notify");
  });

  it("reuses a matching triplet instead of writing a new one", async () => {
    mocks.relations = [
      triplet({ id: "existing", source: "claim", destination: "evidence" }),
    ];
    await expect(createTripletForPair(args)).resolves.toBe("existing");
    expect(mocks.createRelationSchema).not.toHaveBeenCalled();
  });

  it("accepts a matching provisional triplet instead of duplicating it", async () => {
    mocks.provisional.add("imported");
    mocks.relations = [
      triplet({ id: "imported", source: "claim", destination: "evidence" }),
    ];
    await expect(createTripletForPair(args)).resolves.toBe("imported");
    expect(mocks.createRelationSchema).not.toHaveBeenCalled();
    expect(mocks.calls).toContain("accept:imported");
  });

  it("skips the config tree refresh while waiting when the new settings store is on", async () => {
    mocks.newSettingsStore = true;
    mocks.createRelationSchema.mockImplementation(() => {
      mocks.calls.push("create");
      setTimeout(() => mocks.relations.push(triplet({ id: "new-uid" })), 120);
      return Promise.resolve("new-uid");
    });
    await expect(createTripletForPair(args)).resolves.toBe("new-uid");
    const waitCalls = mocks.calls.slice(
      mocks.calls.indexOf("create") + 1,
      mocks.calls.lastIndexOf("refreshConfigTree"),
    );
    expect(waitCalls).not.toContain("refreshConfigTree");
  });

  it("accepts a provisional triplet stored in the mirrored reading", async () => {
    mocks.provisional.add("mirrored");
    mocks.relations = [
      triplet({
        id: "mirrored",
        label: "is supported by",
        complement: "supports",
        source: "evidence",
        destination: "claim",
      }),
    ];
    await expect(createTripletForPair(args)).resolves.toBe("mirrored");
    expect(mocks.createRelationSchema).not.toHaveBeenCalled();
    expect(mocks.calls).toContain("accept:mirrored");
  });

  it("shares one save between concurrent picks of the same triplet", async () => {
    mocks.createRelationSchema.mockImplementation(() => {
      mocks.relations.push(triplet({ id: "new-uid" }));
      return Promise.resolve("new-uid");
    });
    const [first, second] = await Promise.all([
      createTripletForPair(args),
      createTripletForPair(args),
    ]);
    expect([first, second]).toEqual(["new-uid", "new-uid"]);
    expect(mocks.createRelationSchema).toHaveBeenCalledTimes(1);
  });

  it("does not reuse a triplet that runs the other way", async () => {
    mocks.relations = [triplet({ id: "reverse" })];
    mocks.createRelationSchema.mockImplementation(() => {
      mocks.relations.push(triplet({ id: "new-uid" }));
      return Promise.resolve("new-uid");
    });
    await expect(createTripletForPair(args)).resolves.toBe("new-uid");
  });

  it("resolves on a slow settings write and refreshes the canvas once it lands", async () => {
    vi.useFakeTimers();
    try {
      mocks.createRelationSchema.mockResolvedValue("slow-uid");
      const result = createTripletForPair(args);
      await vi.advanceTimersByTimeAsync(3100);
      await expect(result).resolves.toBe("slow-uid");
      expect(mocks.calls).not.toContain("notify");
      mocks.relations.push(triplet({ id: "slow-uid" }));
      await vi.advanceTimersByTimeAsync(600);
      expect(mocks.calls.at(-1)).toBe("notify");
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects without refreshing the canvas when the write throws", async () => {
    mocks.createRelationSchema.mockRejectedValue(
      new Error("Cannot find the relation grammar"),
    );
    await expect(createTripletForPair(args)).rejects.toThrow(
      "Cannot find the relation grammar",
    );
    expect(mocks.calls).toEqual(["refreshConfigTree"]);
  });
});

describe("refreshCanvasRelations", () => {
  it("re-reads relations into discourseContext keyed by label, then notifies", () => {
    mocks.relations = [
      triplet({ id: "a" }),
      triplet({ id: "b", label: "opposes" }),
    ];
    refreshCanvasRelations();
    expect(Object.keys(mocks.context.relations)).toEqual([
      "supports",
      "opposes",
    ]);
    expect(mocks.calls).toEqual(["refreshConfigTree", "notify"]);
  });

  it("keeps relations removed from settings so existing arrows still resolve", () => {
    const deleted = triplet({ id: "deleted", label: "opposes" });
    mocks.context.relations = { opposes: [deleted] };
    mocks.relations = [triplet({ id: "a" })];
    refreshCanvasRelations();
    expect(mocks.context.relations).toEqual({
      supports: [triplet({ id: "a" })],
      opposes: [deleted],
    });
    // Kept for rendering, but marked so creation paths skip it.
    expect(mocks.calls).toContain("deleted:deleted");
    expect(mocks.calls).not.toContain("deleted:a");
  });
});
