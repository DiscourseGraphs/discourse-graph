import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTripletForPair,
  deriveRelationTypes,
  validateNewRelationType,
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
    context,
  };
});
vi.mock("~/components/canvas/Tldraw", () => ({
  discourseContext: mocks.context,
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
});

describe("deriveRelationTypes", () => {
  it("treats a mirrored label / complement pair as one type, keeping the first-seen reading", () => {
    const types = deriveRelationTypes({
      relations: [
        triplet({ id: "a", label: "Informs", complement: "Informed By" }),
        triplet({ id: "b", label: "Informed By", complement: "Informs" }),
      ],
      shownLabels: [],
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
      shownLabels: [],
    });
    expect(types).toEqual([
      { label: "supports", complement: "is supported by" },
      { label: "supports", complement: "backs" },
    ]);
  });

  it("hides a type whose label or complement the pair already shows", () => {
    const relations = [
      triplet({ id: "a" }),
      triplet({ id: "b", label: "opposes", complement: "is opposed by" }),
      triplet({ id: "c", label: "informs", complement: "supports" }),
    ];
    expect(
      deriveRelationTypes({ relations, shownLabels: ["supports"] }),
    ).toEqual([{ label: "opposes", complement: "is opposed by" }]);
    expect(
      deriveRelationTypes({ relations, shownLabels: ["is opposed by"] }).map(
        (t) => t.label,
      ),
    ).toEqual(["supports", "informs"]);
  });

  it("leaves out incomplete and provisional triplets", () => {
    mocks.provisional.add("p");
    const types = deriveRelationTypes({
      relations: [
        triplet({ id: "p", label: "provisional" }),
        triplet({ id: "i", label: "incomplete", complement: "" }),
        triplet({ id: "q", label: "placeholder", destination: "?" }),
      ],
      shownLabels: [],
    });
    expect(types).toEqual([]);
  });

  it("includes triplets with Any (*) node types", () => {
    const types = deriveRelationTypes({
      relations: [triplet({ id: "a", source: "*" })],
      shownLabels: [],
    });
    expect(types).toEqual([
      { label: "supports", complement: "is supported by" },
    ]);
  });
});

describe("validateNewRelationType", () => {
  const validate = (
    label: string,
    complement: string,
    {
      relations = [triplet({ id: "a" })],
      shownLabels = [],
    }: { relations?: DiscourseRelation[]; shownLabels?: string[] } = {},
  ) =>
    validateNewRelationType({
      label,
      complement,
      sourceType: "evidence",
      destinationType: "claim",
      relations,
      shownLabels,
    });

  it("accepts a new label and complement", () => {
    expect(validate("informs", "is informed by")).toBeNull();
  });

  it("requires a label and a complement after trimming", () => {
    expect(validate("  ", "is informed by")).toBe(
      "Label and complement are required.",
    );
    expect(validate("informs", "")).toBe("Label and complement are required.");
  });

  it("rejects a label or complement the pair already shows, ignoring case", () => {
    const shownLabels = ["Opposes"];
    expect(validate("opposes", "x", { shownLabels })).toBe(
      '"Opposes" is already a relation between these node types.',
    );
    expect(validate("x", " OPPOSES ", { shownLabels })).toBe(
      '"Opposes" is already a relation between these node types.',
    );
  });

  it("points an existing label + complement to Add existing, ignoring case", () => {
    expect(validate(" Supports", "IS SUPPORTED BY ")).toBe(
      '"supports" already exists. Use Add existing to add it for these node types.',
    );
  });

  it("lets an exact provisional match on this pair through, since saving accepts it", () => {
    mocks.provisional.add("a");
    mocks.provisional.add("b");
    const relations = [
      triplet({ id: "b", source: "question" }),
      triplet({ id: "a" }),
    ];
    expect(validate("supports", "is supported by", { relations })).toBeNull();
  });

  it("still blocks conflicts when accepting an exact provisional match", () => {
    mocks.provisional.add("a");
    const relations = [
      triplet({ id: "a" }),
      triplet({ id: "b", complement: "backs", source: "question" }),
    ];
    expect(validate("supports", "is supported by", { relations })).toBe(
      'A relation called "supports" already exists with complement "backs".',
    );
  });

  it("treats other provisional matches as duplicates, since saving would add a new triplet", () => {
    mocks.provisional.add("a");
    const duplicate =
      '"supports" already exists as an imported relation type that has not been accepted yet.';
    expect(validate("Supports", "is supported by")).toBe(duplicate);
    const relations = [triplet({ id: "a", source: "question" })];
    expect(validate("supports", "is supported by", { relations })).toBe(
      duplicate,
    );
  });

  it("blocks a label that exists with a different complement, ignoring case", () => {
    expect(validate("SUPPORTS", "backs")).toBe(
      'A relation called "supports" already exists with complement "is supported by".',
    );
  });

  it("blocks a label that is another type's complement, ignoring case", () => {
    expect(validate("Is Supported By", "backs")).toBe(
      '"is supported by" is already the complement of "supports". To add it the other way round, drag in the other direction and choose Add existing.',
    );
  });

  it("blocks a complement that is another type's label, ignoring case", () => {
    expect(validate("backs", "Supports")).toBe(
      '"supports" already exists as a relation. To add it the other way round, drag in the other direction and choose Add existing.',
    );
  });

  it("blocks a complement that is another type's complement, ignoring case", () => {
    expect(validate("backs", "Is Supported By")).toBe(
      '"is supported by" is already the complement of "supports".',
    );
  });

  it("ignores incomplete triplets", () => {
    const relations = [triplet({ id: "i", destination: "?" })];
    expect(validate("supports", "backs", { relations })).toBeNull();
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
      await vi.advanceTimersByTimeAsync(100);
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
