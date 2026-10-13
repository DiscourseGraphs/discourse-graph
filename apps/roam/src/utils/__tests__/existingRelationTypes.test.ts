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
}));
vi.mock("~/utils/relationSchemaAcceptance", () => ({
  isAcceptedRelationSchema: ({ id }: { id: string }) =>
    !mocks.provisional.has(id),
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
      return Promise.resolve("new-uid");
    });
    await expect(createTripletForPair(args)).resolves.toBe("new-uid");
    expect(mocks.createRelationSchema).toHaveBeenCalledWith({
      label: "supports",
      complement: "is supported by",
      source: "claim",
      destination: "evidence",
    });
    expect(mocks.calls).toEqual([
      "refreshConfigTree",
      "create",
      "refreshConfigTree",
      "notify",
    ]);
  });

  it("reuses a matching triplet instead of writing a new one", async () => {
    mocks.relations = [
      triplet({ id: "existing", source: "claim", destination: "evidence" }),
    ];
    await expect(createTripletForPair(args)).resolves.toBe("existing");
    expect(mocks.createRelationSchema).not.toHaveBeenCalled();
  });

  it("does not reuse a triplet that runs the other way", async () => {
    mocks.relations = [triplet({ id: "reverse" })];
    mocks.createRelationSchema.mockResolvedValue("new-uid");
    await expect(createTripletForPair(args)).resolves.toBe("new-uid");
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
});
