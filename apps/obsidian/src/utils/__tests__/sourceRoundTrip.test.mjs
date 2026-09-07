import { beforeEach, describe, expect, it, vi } from "vitest";
import matter from "gray-matter";
import { Notice } from "obsidian";
import { crossAppNodeToDbConcept } from "@repo/database/lib/crossAppConverters";
import { buildSharedNodes } from "@repo/database/lib/sharedNodes";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import { collectDiscourseNodesFromVault } from "../getDiscourseNodes";
import { indexSourceSlotValues } from "../sourceSlot";
import { discourseNodeInstanceToLocalConcept } from "../conceptConversion";
import { loadRelations } from "../relationsStore";
import {
  createHarness,
  REMOTE_URI,
  evidenceRid,
  sourceRid,
} from "./importNodesHarness";
import { nodeUidsWithTypeToCrossApp } from "../../../../roam/src/utils/roamToCrossAppConverters";
import { materializeSharedNode } from "../../../../roam/src/utils/materializeSharedNode";

// Both adapters run here. Only platform I/O and the SQL storage boundary are doubled.
// MJS keeps the two apps' distinct TypeScript/React configurations independent.
const io = vi.hoisted(() => ({
  pages: new Map(),
  identities: new Map(),
  schemas: [],
}));
vi.mock("../../../../roam/src/utils/getDiscourseNodes", () => ({
  default: () => io.schemas,
}));
vi.mock("../../../../roam/src/utils/pageToMarkdown", () => ({
  toMarkdown: () => "Research body",
}));
vi.mock("roamjs-components/queries/getFullTreeByParentUid", () => ({
  default: () => ({ children: [{ text: "Research body", children: [] }] }),
}));
vi.mock("roamjs-components/queries/getPageViewType", () => ({
  default: () => "bullet",
}));
vi.mock("roamjs-components/queries/getPageUidByPageTitle", () => ({
  default: (title) =>
    [...io.pages].find(([, page]) => page.title === title)?.[0] ?? "",
}));
vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: (uid) => io.pages.get(uid)?.title ?? "",
}));
vi.mock("roamjs-components/queries/getShallowTreeByParentUid", () => ({
  default: () => [],
}));
vi.mock("roamjs-components/writes/deleteBlock", () => ({ default: vi.fn() }));
vi.mock("../../../../roam/src/utils/importedSourceIdentity", () => ({
  readImportedSourceIdentity: (uid) => io.identities.get(uid),
  findImportedNodeUidBySourceRid: async (rid) =>
    [...io.identities].find(
      ([, identity]) => identity.sourceNodeRid === rid,
    )?.[0] ?? null,
  writeImportedSourceIdentity: async ({ pageUid, ...identity }) => {
    io.identities.set(pageUid, identity);
  },
}));

const CREATED = "2026-09-01T00:00:00";
const MODIFIED = "2026-09-02T00:00:00";
const CORE_TITLE = "Evidence title";
const SOURCE_TITLE = "@Source title";
const ROAM_TITLE = `[[EVD]] - ${CORE_TITLE} - [[${SOURCE_TITLE}]]`;
const LOCAL_URI = "obsidian:local-vault";
const OBSIDIAN_RID = spaceUriAndLocalIdToRid(LOCAL_URI, "evidence", "note");
const SOURCE_FORMAT = { format: "@{content}" };
const EVIDENCE_FORMAT = { format: "[[EVD]] - {content} - {Source}" };
const context = {
  platform: "Obsidian",
  spaceId: 1,
  userId: 1,
  spacePassword: "test",
};
const sourceConcept = { id: 21, space_id: 1, source_local_id: "source" };

const installRoam = () => {
  const createPage = vi.fn(async ({ page, "markdown-string": body = "" }) => {
    io.pages.set(page.uid, { title: page.title, body });
  });
  const updatePage = vi.fn(async ({ page }) => {
    io.pages.get(page.uid).title = page.title;
  });
  const pullMany = vi.fn(async (pattern, ids) =>
    pattern.includes(":user/uid")
      ? [{ ":db/id": 1, ":user/uid": "author" }]
      : ids.map(([, uid]) => ({
          ":block/uid": uid,
          ":node/title": io.pages.get(uid).title,
          ":create/user": { ":db/id": 1 },
          ":create/time": Date.parse(CREATED + "Z"),
          ":page/edit-time": Date.parse(MODIFIED + "Z"),
        })),
  );
  globalThis.window = {
    roamAlphaAPI: {
      graph: { name: "target-graph" },
      util: { generateUID: () => `page-${io.pages.size + 1}` },
      q: (_query, uid) => (io.pages.has(uid) ? [[uid]] : []),
      updatePage,
      data: {
        async: { pull_many: pullMany },
        page: {
          fromMarkdown: createPage,
          create: createPage,
          delete: async ({ page }) => io.pages.delete(page.uid),
        },
        block: { fromMarkdown: vi.fn() },
      },
    },
  };
  io.schemas = [
    { type: "evidence-type", text: "Evidence", ...EVIDENCE_FORMAT },
    { type: "source-type", text: "Source", ...SOURCE_FORMAT },
  ];
  return { createPage, updatePage };
};

// Mirrors the storage boundary's local-reference resolution using fixed concept IDs.
// No adapter output is hand-written: the actual push result supplies the reference.
const storedSource = (input, references) => {
  const value = input.local_reference_content?.sourceDocument;
  if (value === undefined) return undefined;
  const reference = references.find(
    (row) =>
      row.source_local_id === value ||
      spaceUriAndLocalIdToRid(row.spaceUri, row.source_local_id, "note") ===
        value,
  );
  if (!reference) throw new Error(`Unresolved source fixture: ${value}`);
  return reference;
};

const sharedFromObsidian = ({
  input,
  references = [sourceConcept],
  visible = true,
  localId = "evidence",
  title = "EVD - Evidence title",
  coreTitle = CORE_TITLE,
}) => {
  const stored = storedSource(
    input,
    references.map((row) => ({
      ...row,
      spaceUri: row.space_id === 1 ? LOCAL_URI : REMOTE_URI,
    })),
  );
  const [shared] = buildSharedNodes({
    spaces: [
      { id: 1, name: "Local vault", platform: "Obsidian", url: LOCAL_URI },
      { id: 2, name: "Research", platform: "Roam", url: REMOTE_URI },
    ],
    nodes: [
      {
        is_schema: false,
        schema_id: 10,
        space_id: 1,
        source_local_id: localId,
        last_modified: MODIFIED,
        core_title: coreTitle,
        reference_content: stored ? { sourceDocument: stored.id } : {},
        concepts_of_relation: stored && visible ? [stored] : [],
      },
    ],
    directContents: [
      {
        space_id: 1,
        source_local_id: localId,
        text: title,
        variant: "direct",
        author_id: 1,
        metadata: {},
        created: CREATED,
        last_modified: MODIFIED,
      },
    ],
    fullContentSummaries: [],
  });
  return shared;
};

const contentClient = {
  from: () => {
    const query = {
      select: () => query,
      eq: () => query,
      maybeSingle: async () => ({
        data: { text: "Research body", content_type: "text/obsidian+markdown" },
        error: null,
      }),
    };
    return query;
  },
};

const importSourceIntoRoam = () =>
  materializeSharedNode({
    client: contentClient,
    sharedNode: sharedFromObsidian({
      input: {},
      localId: "source",
      title: "SRC - Source title",
      coreTitle: "Source title",
    }),
    nodeType: SOURCE_FORMAT,
  });
const pullIntoRoam = (sharedNode, force = false) =>
  materializeSharedNode({
    client: contentClient,
    sharedNode,
    nodeType: EVIDENCE_FORMAT,
    force,
  });
const obsidianPush = async (h, relations) => {
  const nodes = await collectDiscourseNodesFromVault(h.plugin, true);
  const nodeTypesById = Object.fromEntries(
    h.plugin.settings.nodeTypes.map((type) => [type.id, type]),
  );
  const values = indexSourceSlotValues({
    relations,
    nodes,
    localSpaceUri: LOCAL_URI,
    nodeTypesById,
  });
  const nodeData = nodes.find((node) => node.nodeInstanceId === "evidence");
  const input = discourseNodeInstanceToLocalConcept({
    context,
    nodeData,
    nodeTypesById,
    sourceSlotByNodeId: values,
  });
  return { input, values };
};
const localNodes = async (h) => {
  await h.create(
    "EVD - Evidence title.md",
    matter.stringify("Research body", {
      nodeInstanceId: "evidence",
      nodeTypeId: "evidence-type",
    }),
  );
  await h.create(
    "SRC - Source title.md",
    matter.stringify("Source body", {
      nodeInstanceId: "source",
      nodeTypeId: "source-type",
    }),
  );
};
const sourceRelation = {
  id: "earliest",
  type: "based-on",
  source: "evidence",
  destination: "source",
  created: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  io.pages.clear();
  io.identities.clear();
  installRoam();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("Roam push → database → Obsidian pull", () => {
  const push = async ({ withSource = true, importedSource = false } = {}) => {
    const title = withSource ? ROAM_TITLE : "[[EVD]] - Evidence title";
    io.schemas[0].format = withSource
      ? EVIDENCE_FORMAT.format
      : "[[EVD]] - {content}";
    io.pages.set("evidence", { title });
    if (withSource) io.pages.set("source", { title: SOURCE_TITLE });
    if (importedSource)
      io.identities.set("source", {
        sourceNodeRid: sourceRid,
        sourceModifiedAt: MODIFIED + "Z",
      });
    const [node] = await nodeUidsWithTypeToCrossApp([
      { uid: "evidence", type: "evidence-type" },
    ]);
    return crossAppNodeToDbConcept(node);
  };
  const publishIntoHarness = (h, input) => {
    const row = h.concepts.find((row) => row.source_local_id === "evidence");
    const stored = storedSource(input, [
      { id: 21, space_id: 2, source_local_id: "source", spaceUri: REMOTE_URI },
    ]);
    row.core_title = input.literal_content.core_title;
    row.sourceDocument = stored?.id ?? null;
    for (const content of input.contents_inline) {
      const row = h.contentRows.find(
        (row) =>
          row.source_local_id === "evidence" && row.variant === content.variant,
      );
      row.text = content.text;
    }
  };

  it.each([false, true])(
    "preserves the referenced Source (producer Source imported=%s)",
    async (importedSource) => {
      const h = createHarness();
      const input = await push({ importedSource });
      expect(input.local_reference_content).toEqual({
        sourceDocument: importedSource ? sourceRid : "source",
      });
      publishIntoHarness(h, input);
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
      const relations = Object.values(
        (await loadRelations(h.plugin)).relations,
      );
      expect(relations).toEqual([
        expect.objectContaining({
          source: evidenceRid,
          destination: sourceRid,
          type: "based-on",
        }),
      ]);
      expect([...h.files.keys()]).toContain(
        "import/Research/SRC - Source title.md",
      );
      const republished = await obsidianPush(h, relations);
      expect(republished.input.local_reference_content).toEqual({
        sourceDocument: sourceRid,
      });
    },
  );

  it("completes without a source or a placeholder", async () => {
    const h = createHarness();
    const input = await push({ withSource: false });
    expect(input.local_reference_content).toBeUndefined();
    publishIntoHarness(h, input);
    expect(await h.pull()).toEqual({ success: 1, failed: 0 });
    expect([...h.files.keys()]).toEqual([
      "import/Research/EVD - Evidence title.md",
    ]);
    expect((await loadRelations(h.plugin)).relations).toEqual({});
    expect(Notice).not.toHaveBeenCalled();
  });

  it.each(["not-shared", "no-content"])(
    "warns without blocking the Evidence when the Source is %s",
    async (reason) => {
      const h = createHarness();
      publishIntoHarness(h, await push());
      if (reason === "not-shared")
        h.concepts.splice(
          h.concepts.findIndex((row) => row.id === 21),
          1,
        );
      else h.contentRows.splice(2);
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
      expect([...h.files.keys()]).toEqual([
        "import/Research/EVD - Evidence title.md",
      ]);
      expect((await loadRelations(h.plugin)).relations).toEqual({});
      expect(Notice).toHaveBeenCalledWith(
        expect.stringContaining("Source is unavailable"),
      );
    },
  );

  it("keeps stable identities, relations and titles across repeated push/pull", async () => {
    const h = createHarness();
    const first = await push();
    publishIntoHarness(h, first);
    await h.pull();
    const originalRelations = await loadRelations(h.plugin);
    const paths = [...h.files.keys()];
    for (let n = 0; n < 3; n++) {
      const input = await push();
      expect(input).toEqual(first);
      publishIntoHarness(h, input);
      expect(await h.pull()).toEqual({ success: 1, failed: 0 });
    }
    expect(await loadRelations(h.plugin)).toEqual(originalRelations);
    expect([...h.files.keys()]).toEqual(paths);
    expect(h.renameFile).not.toHaveBeenCalled();
  });
});

describe("Obsidian push → database → Roam pull", () => {
  it("reconstructs the referenced node from an Obsidian Source relation", async () => {
    const h = createHarness();
    await localNodes(h);
    const { input } = await obsidianPush(h, [sourceRelation]);
    expect(input.local_reference_content).toEqual({ sourceDocument: "source" });
    const shared = sharedFromObsidian({ input });
    expect(shared.slots).toEqual({ sourceDocument: "source" });
    await importSourceIntoRoam();
    const result = await pullIntoRoam(shared);
    expect(result).toMatchObject({
      success: true,
      action: "created",
      sourceNodeRid: OBSIDIAN_RID,
    });
    expect(io.pages.get(result.pageUid).title).toBe(ROAM_TITLE);
  });

  it("selects the earliest Source relation by created date, regardless of array order", async () => {
    const h = createHarness();
    await localNodes(h);
    await h.create(
      "SRC - Newer source.md",
      matter.stringify("body", {
        nodeInstanceId: "newer-source",
        nodeTypeId: "source-type",
      }),
    );
    const relations = [
      {
        ...sourceRelation,
        id: "later",
        destination: "newer-source",
        created: 20,
      },
      sourceRelation,
    ];
    const { input } = await obsidianPush(h, relations);
    expect(input.local_reference_content).toEqual({ sourceDocument: "source" });
    await importSourceIntoRoam();
    const result = await pullIntoRoam(sharedFromObsidian({ input }));
    expect(io.pages.get(result.pageUid).title).toBe(ROAM_TITLE);
  });

  it.each(["absent", "unavailable", "not-imported"])(
    "keeps the incoming title and warns for a %s Source",
    async (state) => {
      const h = createHarness();
      await localNodes(h);
      const { input } = await obsidianPush(
        h,
        state === "absent" ? [] : [sourceRelation],
      );
      const shared = sharedFromObsidian({
        input,
        visible: state !== "unavailable",
      });
      const result = await pullIntoRoam(shared);
      expect(result).toMatchObject({
        success: true,
        action: "created",
        warning: expect.stringContaining("kept as published"),
      });
      expect(io.pages.get(result.pageUid).title).toBe(shared.title);
      expect(io.pages.size).toBe(1);
      if (state === "absent")
        expect(input.local_reference_content).toBeUndefined();
    },
  );

  it("repeated push, pull and forced refresh do not create pages or rename unchanged titles", async () => {
    const h = createHarness();
    await localNodes(h);
    const { createPage, updatePage } = installRoam();
    const { input } = await obsidianPush(h, [sourceRelation]);
    await importSourceIntoRoam();
    const first = await pullIntoRoam(sharedFromObsidian({ input }));
    for (let n = 0; n < 3; n++) {
      const repeated = await obsidianPush(h, [sourceRelation]);
      expect(repeated.input).toEqual(input);
      const shared = sharedFromObsidian({ input: repeated.input });
      expect(await pullIntoRoam(shared)).toMatchObject({
        action: "skipped",
        pageUid: first.pageUid,
      });
      expect(await pullIntoRoam(shared, true)).toMatchObject({
        action: "updated",
        pageUid: first.pageUid,
      });
    }
    expect(io.pages.size).toBe(2);
    expect(createPage).toHaveBeenCalledTimes(2);
    expect(updatePage).not.toHaveBeenCalled();
  });

  it("fills the missing reference after the Source is imported, then keeps the title stable", async () => {
    const h = createHarness();
    await localNodes(h);
    const { updatePage } = installRoam();
    const { input } = await obsidianPush(h, [sourceRelation]);
    const shared = sharedFromObsidian({ input });
    const first = await pullIntoRoam(shared);
    expect(first.warning).toBeDefined();
    await importSourceIntoRoam();
    expect(await pullIntoRoam(shared, true)).toMatchObject({
      success: true,
      action: "updated",
      pageUid: first.pageUid,
    });
    expect(io.pages.get(first.pageUid).title).toBe(ROAM_TITLE);
    await pullIntoRoam(shared, true);
    expect(updatePage).toHaveBeenCalledTimes(1);
    expect(io.pages.size).toBe(2);
  });
});
