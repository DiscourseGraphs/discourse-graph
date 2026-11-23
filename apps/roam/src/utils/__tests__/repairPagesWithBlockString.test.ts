import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPagesWithBlockString,
  repairPagesWithBlockString,
} from "~/utils/repairPagesWithBlockString";

type Entity = {
  title?: string;
  string?: string;
  props?: Record<string, unknown>;
  children: string[];
};

type PageParams = { page: { uid: string; title?: string } };

type BlockParams = {
  block: { uid: string; string?: string; props?: Record<string, unknown> };
};

type MoveParams = BlockParams & {
  location: { "parent-uid": string; order: number };
};

type Writes = {
  createPage: (params: PageParams) => void;
  deletePage: (params: PageParams) => void;
  moveBlock: (params: MoveParams) => void;
  updatePage: (params: PageParams) => void;
  updateBlock: (params: BlockParams) => void;
};

const HOLDING_PAGE_UID = "holding";
const HOLDING_PAGE_TITLE = `DG page repair ${HOLDING_PAGE_UID}`;
const CLAIM_TITLE = "[[CLM]] - Claim";
const EVIDENCE_TITLE = `[[EVD]] - Backs [[${CLAIM_TITLE}]]`;

const { graph, writes } = vi.hoisted(() => ({
  graph: new Map<string, Entity>(),
  writes: {} as Writes,
}));

vi.mock("roamjs-components/writes/submitActions", () => ({
  default: (
    actions: { type: keyof Writes; params: PageParams & MoveParams }[],
  ): Promise<void> =>
    new Promise((resolve) => {
      actions.forEach(({ type, params }) => writes[type](params));
      resolve();
    }),
}));
vi.mock("roamjs-components/queries/getPageTitleByPageUid", () => ({
  default: (uid: string): string => graph.get(uid)?.title ?? "",
}));
vi.mock("roamjs-components/queries/getShallowTreeByParentUid", () => ({
  default: (uid: string): { uid: string }[] =>
    (graph.get(uid)?.children ?? []).map((childUid) => ({ uid: childUid })),
}));
vi.mock("roamjs-components/queries/getTextByBlockUid", () => ({
  default: (uid: string): string => graph.get(uid)?.string ?? "",
}));
vi.mock("~/utils/getBlockProps", () => ({
  default: (uid: string): Record<string, unknown> =>
    graph.get(uid)?.props ?? {},
}));

const getEntity = (uid: string): Entity => {
  const entity = graph.get(uid);
  if (!entity) throw new Error(`No entity with uid ${uid}`);
  return entity;
};

const unlink = (text: string | undefined, title: string): string | undefined =>
  text?.replaceAll(`[[${title}]]`, title);

// Behaves as Roam did in the ENG-2495 probe: updatePage rejects a page that has
// a block string, and deletePage removes the page's blocks and turns every link
// to the page into plain text.
const createWrites = (): Writes => ({
  createPage: ({ page: { uid, title } }) => {
    if ([...graph.values()].some((entity) => entity.title === title))
      throw new Error(`Page ${title} already exists`);
    graph.set(uid, { title, children: [] });
  },
  deletePage: ({ page: { uid } }) => {
    const { title = "", children } = getEntity(uid);
    [uid, ...children].forEach((deletedUid) => graph.delete(deletedUid));
    graph.forEach((entity) => {
      entity.title = unlink(entity.title, title);
      entity.string = unlink(entity.string, title);
    });
  },
  moveBlock: ({ block: { uid }, location }) => {
    const parent = getEntity(location["parent-uid"]);
    graph.forEach((entity) => {
      entity.children = entity.children.filter((childUid) => childUid !== uid);
    });
    parent.children.splice(location.order, 0, uid);
  },
  updatePage: ({ page: { uid, title } }) => {
    const page = getEntity(uid);
    if (page.string !== undefined)
      throw new Error("is a block, not a page — use update-block");
    page.title = title;
  },
  updateBlock: ({ block: { uid, ...changes } }) => {
    Object.assign(getEntity(uid), changes);
  },
});

const queryPagesWithBlockString = (): Promise<string[][]> =>
  Promise.resolve(
    [...graph].flatMap(([uid, { title, string }]) =>
      title !== undefined && string !== undefined ? [[uid, title]] : [],
    ),
  );

const queryLinksToPage = (_query: string, pageUid: string): string[][] => {
  const link = `[[${getEntity(pageUid).title}]]`;
  return [...graph].flatMap(([uid, { title = "", string = "" }]) =>
    title.includes(link) || string.includes(link) ? [[uid, title, string]] : [],
  );
};

const snapshot = (): Record<string, Entity> =>
  structuredClone(Object.fromEntries(graph));

const repairAffectedPages = async (): ReturnType<
  typeof repairPagesWithBlockString
> => repairPagesWithBlockString(await getPagesWithBlockString());

beforeEach(() => {
  graph.clear();
  Object.entries<Entity>({
    claim: {
      title: CLAIM_TITLE,
      string: "[[CLM]] - Renamed",
      props: { "discourse-graph": { shared: true } },
      children: ["first", "second"],
    },
    first: { string: "First", children: [] },
    second: { string: `Restates [[${CLAIM_TITLE}]]`, children: [] },
    evidence: { title: EVIDENCE_TITLE, children: [] },
    notes: { title: "Notes", children: ["mention"] },
    mention: { string: `Supports [[${CLAIM_TITLE}]]`, children: [] },
  }).forEach(([uid, entity]) => graph.set(uid, entity));
  Object.assign(writes, createWrites());
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: {
      q: queryLinksToPage,
      data: { async: { fast: { q: queryPagesWithBlockString } } },
      util: { generateUID: () => HOLDING_PAGE_UID },
    },
  };
});

describe("repairPagesWithBlockString", () => {
  it("removes the block string and keeps the page's uid, blocks, props and links", async () => {
    const before = snapshot();

    await expect(repairAffectedPages()).resolves.toEqual({
      repaired: 1,
      failures: [],
    });
    expect(snapshot()).toEqual({
      ...before,
      claim: { ...before.claim, string: undefined },
    });
  });

  it("repairs a page whose title links another affected page first", async () => {
    getEntity("evidence").string = "[[EVD]] - Renamed";
    const before = snapshot();
    const pages = await getPagesWithBlockString();

    expect(pages.map(({ uid }) => uid)).toEqual(["evidence", "claim"]);
    await expect(repairPagesWithBlockString(pages)).resolves.toEqual({
      repaired: 2,
      failures: [],
    });
    expect(snapshot()).toEqual({
      ...before,
      claim: { ...before.claim, string: undefined },
      evidence: { ...before.evidence, string: undefined },
    });
  });

  it("reports a page it can't repair, leaves it as it was and repairs the rest", async () => {
    getEntity("evidence").string = "[[EVD]] - Renamed";
    const before = snapshot();
    const pages = await getPagesWithBlockString();

    await expect(repairPagesWithBlockString(pages.reverse())).resolves.toEqual({
      repaired: 1,
      failures: [
        {
          title: CLAIM_TITLE,
          error: "is a block, not a page — use update-block",
        },
      ],
    });
    expect(snapshot()).toEqual({
      ...before,
      evidence: { ...before.evidence, string: undefined },
    });
  });

  it("puts the blocks and links back when Roam keeps the page", async () => {
    const before = snapshot();
    const { deletePage } = writes;
    writes.deletePage = (params): void => {
      if (params.page.uid !== "claim") deletePage(params);
    };

    await expect(repairAffectedPages()).resolves.toEqual({
      repaired: 0,
      failures: [{ title: CLAIM_TITLE, error: "Roam kept the page" }],
    });
    expect(snapshot()).toEqual(before);
  });

  it("restores the links and says where the blocks are when it can't move them back", async () => {
    const before = snapshot();
    const { deletePage, moveBlock } = writes;
    writes.deletePage = (params): void => {
      if (params.page.uid !== "claim") deletePage(params);
    };
    writes.moveBlock = (params): void => {
      if (params.location["parent-uid"] === "claim")
        throw new Error("Roam is offline");
      moveBlock(params);
    };

    await expect(repairAffectedPages()).resolves.toEqual({
      repaired: 0,
      failures: [
        {
          title: CLAIM_TITLE,
          error: `Roam kept the page. Not restored: its blocks, which may be on the page "${HOLDING_PAGE_TITLE}" (Roam is offline).`,
        },
      ],
    });
    expect(snapshot()).toEqual({
      ...before,
      claim: { ...before.claim, children: [] },
      [HOLDING_PAGE_UID]: {
        title: HOLDING_PAGE_TITLE,
        children: ["first", "second"],
      },
    });
  });

  it("restores everything else when one link can't be restored", async () => {
    const before = snapshot();
    const { updateBlock } = writes;
    writes.updateBlock = (params): void => {
      if (params.block.uid === "second") throw new Error("Roam is offline");
      updateBlock(params);
    };

    await expect(repairAffectedPages()).resolves.toEqual({
      repaired: 0,
      failures: [
        {
          title: CLAIM_TITLE,
          error:
            "The page can be renamed again. Not restored: the link in block ((second)) (Roam is offline).",
        },
      ],
    });
    expect(snapshot()).toEqual({
      ...before,
      claim: { ...before.claim, string: undefined },
      second: { ...before.second, string: `Restates ${CLAIM_TITLE}` },
    });
  });

  it("says where the blocks are when the page can't be created again", async () => {
    const { createPage } = writes;
    writes.createPage = (params): void => {
      if (params.page.uid === "claim") throw new Error("Roam is offline");
      createPage(params);
    };

    await expect(repairAffectedPages()).resolves.toEqual({
      repaired: 0,
      failures: [
        {
          title: CLAIM_TITLE,
          error: `Roam is offline. Roam deleted the page and didn't create it again. Its blocks are on the page "${HOLDING_PAGE_TITLE}". Its properties and the links to it were not restored.`,
        },
      ],
    });
    expect(getEntity(HOLDING_PAGE_UID).children).toEqual(["first", "second"]);
  });
});
