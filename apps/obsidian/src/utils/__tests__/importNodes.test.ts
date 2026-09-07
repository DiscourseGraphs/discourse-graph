import {
  createHarness,
  evidenceRid,
  sourceRid,
  selectedNode,
} from "./importNodesHarness";
import { beforeEach, describe, expect, it, vi } from "vitest";
import matter from "gray-matter";
import { Notice } from "obsidian";
import type { RelationInstance } from "~/types";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import { importSelectedNodes, refreshImportedFile } from "../importNodes";
import { loadRelations, saveRelations } from "../relationsStore";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("source document import", () => {
  it("imports an available Source and creates one local relation", async () => {
    const h = createHarness();
    expect(await h.pull()).toEqual({ success: 1, failed: 0 });
    expect([...h.files.keys()]).toContain(
      "import/Research/SRC - Source title.md",
    );
    expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual([
      expect.objectContaining({
        type: "based-on",
        source: evidenceRid,
        destination: sourceRid,
      }),
    ]);
    expect(Notice).not.toHaveBeenCalled();
    expect(
      h.requests.find(
        (request) => request.select === "id, source_local_id, space_id",
      )?.filters,
    ).toEqual([
      ["is_schema", false],
      ["is_relation", false],
      ["id", [21]],
    ]);
  });

  it.each([false, true])(
    "reuses an existing Source (local=%s)",
    async (local) => {
      const h = createHarness();
      if (local) h.concepts.find((row) => row.id === 21)!.space_id = 1;
      const sourceFile = await h.seedSource(local);
      const original = h.contents.get(sourceFile.path);
      await h.pull();
      expect(h.contents.get(sourceFile.path)).toBe(original);
      expect(
        [...h.files.values()].filter((file) => file.extension === "md"),
      ).toHaveLength(2);
      expect(
        Object.values((await loadRelations(h.plugin)).relations)[0]
          ?.destination,
      ).toBe(local ? "source" : sourceRid);
      expect(
        h.requests.filter((request) => request.table === "my_contents"),
      ).toHaveLength(1);
    },
  );

  it.each(["triple", "type"])(
    "imports the Source without creating a missing relation %s",
    async (missing) => {
      const h = createHarness();
      if (missing === "triple") h.plugin.settings.discourseRelations = [];
      else h.plugin.settings.relationTypes = [];
      const settings = structuredClone(h.plugin.settings);
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
      expect(
        [...h.files.values()].filter((file) => file.extension === "md"),
      ).toHaveLength(2);
      expect((await loadRelations(h.plugin)).relations).toEqual({});
      expect(h.plugin.settings).toEqual(settings);
      expect(h.saveSettings).not.toHaveBeenCalled();
    },
  );

  it.each(["triple", "type"])(
    "does not materialize a relation through a provisional %s",
    async (provisional) => {
      const h = createHarness();
      const schema =
        provisional === "triple"
          ? h.plugin.settings.discourseRelations[0]!
          : h.plugin.settings.relationTypes[0]!;
      schema.importedFromRid = "orn:obsidian.schema:remote/relation-type";
      schema.status = "provisional";
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
      expect(
        [...h.files.values()].filter((file) => file.extension === "md"),
      ).toHaveLength(2);
      expect((await loadRelations(h.plugin)).relations).toEqual({});
      schema.status = "accepted";
      await h.pull();
      expect(
        Object.values((await loadRelations(h.plugin)).relations),
      ).toHaveLength(1);
    },
  );

  it("does nothing when the current node has no source value", async () => {
    const h = createHarness();
    h.concepts.find((row) => row.id === 20)!.sourceDocument = null;
    expect(await h.pull()).toEqual({ success: 1, failed: 0 });
    expect(h.files.size).toBe(1);
    expect(
      h.requests.some(
        (request) => request.select === "id, source_local_id, space_id",
      ),
    ).toBe(false);
    expect(Notice).not.toHaveBeenCalled();
  });

  it.each(["not-shared", "no-content", "query-error"])(
    "keeps the current node when the Source is unavailable: %s",
    async (reason) => {
      const h = createHarness();
      if (reason === "not-shared")
        h.concepts.splice(
          h.concepts.findIndex((row) => row.id === 21),
          1,
        );
      if (reason === "no-content") h.contentRows.splice(2);
      if (reason === "query-error") h.failSourceQuery();
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
      expect([...h.files.keys()]).toEqual([
        "import/Research/EVD - Evidence title.md",
      ]);
      expect((await loadRelations(h.plugin)).relations).toEqual({});
      expect(Notice).toHaveBeenCalledWith(expect.stringMatching(/source/i));
      expect(console.warn).toHaveBeenCalled();
    },
  );

  it("repeated pull and refresh reuse both nodes and the relation without renaming", async () => {
    const h = createHarness();
    await h.pull();
    const firstRelations = await loadRelations(h.plugin);
    const paths = [...h.files.keys()];
    await h.pull();
    const file = h.files.get("import/Research/EVD - Evidence title.md")!;
    expect(await refreshImportedFile({ plugin: h.plugin, file })).toEqual({
      success: true,
      error: undefined,
    });
    expect([...h.files.keys()]).toEqual(paths);
    expect(await loadRelations(h.plugin)).toEqual(firstRelations);
    expect(h.renameFile).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "reuses a manually created relation (local RIDs=%s)",
    async (localRids) => {
      const h = createHarness();
      await h.seedSource();
      const relation: RelationInstance = {
        id: "manual",
        type: "based-on",
        source: localRids
          ? spaceUriAndLocalIdToRid("obsidian:local-vault", "evidence", "note")
          : "evidence",
        destination: localRids
          ? spaceUriAndLocalIdToRid("obsidian:local-vault", "source", "note")
          : "source",
        created: 1,
      };
      await saveRelations(h.plugin, {
        version: 1,
        lastModified: 1,
        relations: { manual: relation },
      });
      await h.pull();
      expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual([
        relation,
      ]);
    },
  );

  it("shares one Source across a batch even while the metadata cache is empty", async () => {
    const h = createHarness();
    h.getFileCache.mockReturnValue({ frontmatter: {} });
    const evidence = h.concepts.find((row) => row.id === 20)!;
    h.concepts.push({
      ...evidence,
      id: 22,
      source_local_id: "second",
      core_title: "Second evidence",
    });
    h.contentRows.push(
      ...h.contentRows
        .slice(0, 2)
        .map((row) => ({ ...row, source_local_id: "second" })),
    );
    expect(
      await importSelectedNodes({
        plugin: h.plugin,
        selectedNodes: [
          selectedNode,
          { ...selectedNode, nodeInstanceId: "second" },
        ],
      }),
    ).toEqual({ success: 2, failed: 0 });
    expect(
      [...h.files.values()].filter((file) => file.extension === "md"),
    ).toHaveLength(3);
    expect(
      Object.values((await loadRelations(h.plugin)).relations),
    ).toHaveLength(2);
    expect(
      h.create.mock.calls.filter(([path]) => path.includes("SRC -")),
    ).toHaveLength(1);
  });

  it("keeps distinct same-titled Sources and their relations through repeated pulls", async () => {
    const h = createHarness();
    h.concepts.push(
      {
        ...h.concepts.find((row) => row.id === 20)!,
        id: 22,
        source_local_id: "second-evidence",
        core_title: "Second evidence",
        sourceDocument: 23,
      },
      {
        ...h.concepts.find((row) => row.id === 21)!,
        id: 23,
        source_local_id: "second-source",
      },
    );
    h.contentRows.push(
      ...h.contentRows.map((row) => ({
        ...row,
        source_local_id: `second-${String(row.source_local_id)}`,
        text: `Second ${String(row.text)}`,
      })),
    );
    const pull = () =>
      importSelectedNodes({
        plugin: h.plugin,
        selectedNodes: [
          selectedNode,
          { ...selectedNode, nodeInstanceId: "second-evidence" },
        ],
      });
    expect(await pull()).toEqual({ success: 2, failed: 0 });
    const sources = [...h.files.values()].filter(
      (file) =>
        matter(h.contents.get(file.path)!).data.nodeTypeId === "source-type",
    );
    expect(sources).toHaveLength(2);
    const sourceContents = sources.map((file) => h.contents.get(file.path)!);
    expect(
      sourceContents.some(
        (content) => matter(content).content.trim() === "source body",
      ),
    ).toBe(true);
    expect(
      sourceContents.some(
        (content) => matter(content).content.trim() === "Second source body",
      ),
    ).toBe(true);
    const relations = Object.values((await loadRelations(h.plugin)).relations);
    expect(relations).toHaveLength(2);
    expect(new Set(relations.map((relation) => relation.destination))).toEqual(
      new Set(
        sourceContents.map((content) =>
          String(matter(content).data.importedFromRid),
        ),
      ),
    );
    const paths = [...h.files.keys()];
    await pull();
    await refreshImportedFile({ plugin: h.plugin, file: sources[1]! });
    await pull();
    expect([...h.files.keys()]).toEqual(paths);
    expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual(
      relations,
    );
    expect(h.renameFile).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    "resolves a local Source despite a same-ID import (Datacore=%s)",
    async (datacore) => {
      const h = createHarness();
      h.concepts.find((row) => row.id === 21)!.space_id = 1;
      await h.seedSource();
      const localSource = await h.create(
        "Local source.md",
        matter.stringify("Local source", {
          nodeInstanceId: "source",
          nodeTypeId: "source-type",
        }),
      );
      if (datacore)
        Object.assign(h.plugin.app, {
          plugins: {
            plugins: {
              datacore: {
                api: {
                  query: (query: string) =>
                    [...h.files.values()]
                      .filter((file) => {
                        const frontmatter = matter(
                          h.contents.get(file.path)!,
                        ).data;
                        return (
                          file.extension === "md" &&
                          [
                            ...query.matchAll(
                              /(nodeInstanceId|importedFromRid) = "([^"]+)"/g,
                            ),
                          ].every(
                            ([, key, value]) => frontmatter[key!] === value,
                          )
                        );
                      })
                      .map((file) => ({ $path: file.path })),
                },
              },
            },
          },
        });
      await h.pull();
      expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual([
        expect.objectContaining({ source: evidenceRid, destination: "source" }),
      ]);
      expect(h.contents.get(localSource.path)).toContain("Local source");
    },
  );

  it.each([false, true])(
    "does not confuse same-ID local and imported relations (local RIDs=%s)",
    async (localRids) => {
      const h = createHarness();
      for (const id of ["evidence", "source"]) {
        await h.create(
          `Local ${id}.md`,
          matter.stringify(`Local ${id} body`, {
            nodeInstanceId: id,
            nodeTypeId: `${id}-type`,
          }),
        );
      }
      const manual: RelationInstance = {
        id: "local-relation",
        type: "based-on",
        source: localRids
          ? spaceUriAndLocalIdToRid("obsidian:local-vault", "evidence", "note")
          : "evidence",
        destination: localRids
          ? spaceUriAndLocalIdToRid("obsidian:local-vault", "source", "note")
          : "source",
        created: 1,
      };
      await saveRelations(h.plugin, {
        version: 1,
        lastModified: 1,
        relations: { [manual.id]: manual },
      });
      await h.pull();
      await h.pull();
      expect(Object.values((await loadRelations(h.plugin)).relations)).toEqual([
        manual,
        expect.objectContaining({
          source: evidenceRid,
          destination: sourceRid,
        }),
      ]);
    },
  );
});
