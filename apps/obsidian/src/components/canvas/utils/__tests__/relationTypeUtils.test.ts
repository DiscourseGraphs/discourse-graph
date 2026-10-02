import { describe, expect, it, vi } from "vitest";
import type DiscourseGraphPlugin from "~/index";
import {
  associateRelationTypeWithNodePair,
  createRelationTypeForNodePair,
  getAssociableRelationTypesForNodePair,
} from "~/components/canvas/utils/relationTypeUtils";
import type { DiscourseRelation, DiscourseRelationType } from "~/types";

const relationType = (
  id: string,
  overrides: Partial<DiscourseRelationType> = {},
): DiscourseRelationType => ({
  id,
  label: id,
  complement: `${id} complement`,
  color: "black",
  created: 0,
  modified: 0,
  ...overrides,
});

const relation = (
  relationshipTypeId: string,
  sourceId: string,
  destinationId: string,
): DiscourseRelation => ({
  id: `${relationshipTypeId}-${sourceId}-${destinationId}`,
  relationshipTypeId,
  sourceId,
  destinationId,
  created: 0,
  modified: 0,
});

describe("getAssociableRelationTypesForNodePair", () => {
  const relationTypes = [
    relationType("supports"),
    relationType("opposes"),
    relationType("informs"),
    relationType("provisional", {
      importedFromRid: "rid:provisional",
      status: "provisional",
    }),
    relationType("importedAccepted", {
      importedFromRid: "rid:accepted",
      status: "accepted",
    }),
  ];
  const discourseRelations = [
    relation("supports", "evidence", "claim"),
    relation("opposes", "claim", "evidence"),
    relation("informs", "evidence", "question"),
  ];

  const associableIds = (
    relations: DiscourseRelation[],
    sourceNodeTypeId: string,
    targetNodeTypeId: string,
  ): string[] =>
    getAssociableRelationTypesForNodePair({
      settings: { relationTypes, discourseRelations: relations },
      sourceNodeTypeId,
      targetNodeTypeId,
    }).map(({ id }) => id);

  it("excludes types valid for the pair in either direction", () => {
    expect(associableIds(discourseRelations, "evidence", "claim")).toEqual([
      "informs",
      "importedAccepted",
    ]);
  });

  it("offers every accepted type for a pair with no relations", () => {
    expect(associableIds(discourseRelations, "question", "claim")).toEqual([
      "supports",
      "opposes",
      "informs",
      "importedAccepted",
    ]);
  });

  it("excludes a type made valid by a provisional relation", () => {
    const relations: DiscourseRelation[] = [
      ...discourseRelations,
      {
        ...relation("informs", "claim", "evidence"),
        importedFromRid: "rid:informs",
        status: "provisional",
      },
    ];
    expect(associableIds(relations, "evidence", "claim")).toEqual([
      "importedAccepted",
    ]);
  });
});

describe("associateRelationTypeWithNodePair", () => {
  const setup = (saveSettings: () => Promise<void>) => {
    const existing = [relation("supports", "evidence", "claim")];
    const plugin = {
      settings: { discourseRelations: existing },
      saveSettings: vi.fn(saveSettings),
    };
    return {
      existing,
      plugin,
      associate: () =>
        associateRelationTypeWithNodePair({
          plugin: plugin as unknown as DiscourseGraphPlugin,
          relationTypeId: "informs",
          sourceNodeTypeId: "question",
          targetNodeTypeId: "claim",
        }),
    };
  };

  it("saves a new local source → target relation in a new array", async () => {
    const { existing, plugin, associate } = setup(() => Promise.resolve());
    await associate();

    const relations = plugin.settings.discourseRelations;
    const added = relations.at(-1);
    expect(relations).not.toBe(existing);
    expect(relations).toHaveLength(2);
    expect(added).toMatchObject({
      sourceId: "question",
      destinationId: "claim",
      relationshipTypeId: "informs",
    });
    expect(added?.id).toMatch(/^rel3_/);
    expect(added).not.toHaveProperty("status");
    expect(added).not.toHaveProperty("importedFromRid");
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
  });

  it("removes the added relation and rethrows when saving fails", async () => {
    const { existing, plugin, associate } = setup(() =>
      Promise.reject(new Error("disk full")),
    );
    await expect(associate()).rejects.toThrow("disk full");
    expect(plugin.settings.discourseRelations).toEqual(existing);
  });
});

describe("createRelationTypeForNodePair", () => {
  const setup = (saveSettings: () => Promise<void>) => {
    const existingTypes = [relationType("supports")];
    const existingRelations = [relation("supports", "evidence", "claim")];
    const plugin = {
      settings: {
        relationTypes: existingTypes,
        discourseRelations: existingRelations,
      },
      saveSettings: vi.fn(saveSettings),
    };
    return {
      existingTypes,
      existingRelations,
      plugin,
      create: () =>
        createRelationTypeForNodePair({
          plugin: plugin as unknown as DiscourseGraphPlugin,
          label: "informs",
          complement: "is informed by",
          color: "blue",
          sourceNodeTypeId: "question",
          targetNodeTypeId: "claim",
        }),
    };
  };

  it("saves a local type and its source → target relation once", async () => {
    const { plugin, create } = setup(() => Promise.resolve());
    const created = await create();

    expect(created).toMatchObject({
      label: "informs",
      complement: "is informed by",
      color: "blue",
    });
    expect(created.id).toMatch(/^rel_/);
    expect(created).not.toHaveProperty("status");
    expect(plugin.settings.relationTypes.at(-1)).toBe(created);
    expect(plugin.settings.discourseRelations.at(-1)).toMatchObject({
      sourceId: "question",
      destinationId: "claim",
      relationshipTypeId: created.id,
    });
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
  });

  it("removes only the added type and relation when saving fails", async () => {
    const { existingTypes, existingRelations, plugin, create } = setup(() =>
      Promise.reject(new Error("disk full")),
    );
    await expect(create()).rejects.toThrow("disk full");
    expect(plugin.settings.relationTypes).toEqual(existingTypes);
    expect(plugin.settings.discourseRelations).toEqual(existingRelations);
  });

  it("keeps a type added while its save was pending when saving fails", async () => {
    const concurrent = relationType("concurrent");
    const { existingTypes, plugin, create } = setup(() => {
      plugin.settings.relationTypes = [
        ...plugin.settings.relationTypes,
        concurrent,
      ];
      return Promise.reject(new Error("disk full"));
    });
    await expect(create()).rejects.toThrow("disk full");
    expect(plugin.settings.relationTypes).toEqual([
      ...existingTypes,
      concurrent,
    ]);
  });
});
