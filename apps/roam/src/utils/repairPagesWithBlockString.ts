import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import type { ActionParams } from "roamjs-components/types";
import submitActions from "roamjs-components/writes/submitActions";
import getBlockProps from "./getBlockProps";
import { getErrorMessage } from "./getErrorMessage";

type PageWithBlockString = { uid: string; title: string };

type PageRepairResult = {
  repaired: number;
  failures: { title: string; error: string }[];
};

type Link = { uid: string; text: string };

type Links = { pages: Link[]; blocks: Link[] };

type RestoreStep = { restores: string; run: () => Promise<void> };

type WriteType = Parameters<typeof submitActions>[0][number]["type"];

const HOLDING_PAGE_TITLE_PREFIX = "DG page repair ";

// submitActions retries a write that Roam rejects as busy, so a repair with many
// links isn't cut off part-way. It calls window.roamAlphaAPI[type], so moveBlock
// works even though its type list omits it.
const write = (
  type: WriteType | "moveBlock",
  params: ActionParams,
): Promise<void> => submitActions([{ type: type as WriteType, params }]);

/**
 * Pages that Roam refuses to rename because they have a `:block/string`. Before
 * ENG-2463, renaming a page node from the canvas wrote one.
 *
 * Longest title first: a title that links another page is longer than that page's
 * title, so the linking page is repaired before the page it links. The repair
 * renames linking pages, and Roam can't rename one that still has its block string.
 */
export const getPagesWithBlockString = async (): Promise<
  PageWithBlockString[]
> =>
  (
    (await window.roamAlphaAPI.data.async.fast.q(
      `[:find ?uid ?title :where [?page :node/title ?title] [?page :block/string _] [?page :block/uid ?uid]]`,
    )) as [string, string][]
  )
    .map(([uid, title]) => ({ uid, title }))
    .sort((a, b) => b.title.length - a.title.length);

// Read with the synchronous q on purpose: it runs right after the repair's own
// writes and has to see them. deletePage rewrites a link that is missed here,
// and nothing restores it.
const getLinksToPage = (pageUid: string): Links => {
  const rows = (
    window.roamAlphaAPI.q(
      `[:find ?uid ?title ?string :in $ ?page-uid :where
        [?page :block/uid ?page-uid]
        [?linking :block/refs ?page]
        [?linking :block/uid ?uid]
        [(get-else $ ?linking :node/title "") ?title]
        [(get-else $ ?linking :block/string "") ?string]]`,
      pageUid,
    ) as [string, string, string][]
  )
    // The page links itself when its block string holds its own title.
    .filter(([uid]) => uid !== pageUid);
  return {
    pages: rows
      .filter(([, title]) => title)
      .map(([uid, title]) => ({ uid, text: title }))
      .sort((a, b) => a.text.length - b.text.length),
    blocks: rows
      .filter(([, title]) => !title)
      .map(([uid, , string]) => ({ uid, text: string })),
  };
};

const moveBlocks = async ({
  blockUids,
  parentUid,
}: {
  blockUids: string[];
  parentUid: string;
}): Promise<void> => {
  for (const [order, uid] of blockUids.entries()) {
    await write("moveBlock", {
      location: { "parent-uid": parentUid, order },
      block: { uid },
    });
  }
};

// Titles before blocks, shortest title first: restoring an inner title lets Roam
// rewrite the titles and blocks that link it, and a block restored before the
// title it links would create a second page with that title.
const getLinkRestoreSteps = ({ pages, blocks }: Links): RestoreStep[] => [
  ...pages.map(({ uid, text }) => ({
    restores: `the link in the title of "${text}"`,
    run: async (): Promise<void> => {
      if (getPageTitleByPageUid(uid) !== text)
        await write("updatePage", { page: { uid, title: text } });
    },
  })),
  ...blocks.map(({ uid, text }) => ({
    restores: `the link in block ((${uid}))`,
    run: async (): Promise<void> => {
      if (getTextByBlockUid(uid) !== text)
        await write("updateBlock", { block: { uid, string: text } });
    },
  })),
];

// Every step runs even after one fails. Only this run knows the original links
// and props, so what it doesn't restore now can't be restored later.
const runRestoreSteps = async (steps: RestoreStep[]): Promise<string[]> => {
  const notRestored: string[] = [];
  for (const { restores, run } of steps) {
    try {
      await run();
    } catch (error) {
      notRestored.push(`${restores} (${getErrorMessage(error)})`);
    }
  }
  return notRestored;
};

const withNotRestored = (message: string, notRestored: string[]): string =>
  notRestored.length
    ? `${message}. Not restored: ${notRestored.join("; ")}.`
    : message;

// When deletePage unlinks a page title that a block also links, Roam merges that
// page into a new one and its uid changes. Renaming the linking pages first keeps
// their uids, and leaves deletePage only block links to rewrite.
const unlinkPageTitles = async ({
  uid,
  title,
  pages,
}: PageWithBlockString & { pages: Link[] }): Promise<void> => {
  for (const page of pages) {
    const linkingTitle = getPageTitleByPageUid(page.uid);
    if (linkingTitle.includes(`[[${title}]]`))
      await write("updatePage", {
        page: {
          uid: page.uid,
          title: linkingTitle.split(`[[${title}]]`).join(title),
        },
      });
  }
  if (getLinksToPage(uid).pages.length)
    throw new Error("Another page's title still links it");
};

/**
 * No API call removes a page's block string: `updatePage` and `deleteBlock` both
 * reject the page. `deletePage` works, so the page is deleted and created again
 * with the same uid and title.
 *
 * `deletePage` also deletes the page's blocks and props, and rewrites every
 * `[[title]]` link to the page into plain text. Each is saved first and put back
 * afterwards.
 *
 * A failure before the delete is undone. After the delete there is no way back,
 * so every restore step still runs and the error lists what Roam didn't restore.
 *
 * Not restored: the page's create time and author become the repair's, and the
 * page loses its view type and its left sidebar shortcut.
 */
const repairPage = async ({
  uid,
  title,
}: PageWithBlockString): Promise<void> => {
  const blockUids = getShallowTreeByParentUid(uid).map((block) => block.uid);
  const props = getBlockProps(uid);
  const links = getLinksToPage(uid);
  const holdingPageUid = window.roamAlphaAPI.util.generateUID();
  const holdingPageTitle = `${HOLDING_PAGE_TITLE_PREFIX}${holdingPageUid}`;
  const restoreBlocks: RestoreStep = {
    restores: `its blocks, which may be on the page "${holdingPageTitle}"`,
    run: async (): Promise<void> => {
      await moveBlocks({ blockUids, parentUid: uid });
      await write("deletePage", { page: { uid: holdingPageUid } });
    },
  };
  const restoreProps: RestoreStep = {
    restores: "its properties",
    run: (): Promise<void> => write("updateBlock", { block: { uid, props } }),
  };
  const restoreLinks = getLinkRestoreSteps(links);

  try {
    await unlinkPageTitles({ uid, title, pages: links.pages });
    await write("createPage", {
      page: { title: holdingPageTitle, uid: holdingPageUid },
    });
    await moveBlocks({ blockUids, parentUid: holdingPageUid });
    await write("deletePage", { page: { uid } });
    // deletePage can resolve without deleting the page.
    if (getPageTitleByPageUid(uid)) throw new Error("Roam kept the page");
  } catch (error) {
    const notRestored = await runRestoreSteps([
      ...(getPageTitleByPageUid(holdingPageUid) ? [restoreBlocks] : []),
      ...restoreLinks,
    ]);
    throw new Error(withNotRestored(getErrorMessage(error), notRestored));
  }

  try {
    await write("createPage", { page: { title, uid } });
  } catch (error) {
    throw new Error(
      `${getErrorMessage(error)}. Roam deleted the page and didn't create it again. Its blocks are on the page "${holdingPageTitle}". Its properties and the links to it were not restored.`,
    );
  }
  const notRestored = await runRestoreSteps([
    restoreBlocks,
    ...(Object.keys(props).length ? [restoreProps] : []),
    ...restoreLinks,
  ]);
  if (notRestored.length)
    throw new Error(
      withNotRestored("The page can be renamed again", notRestored),
    );
};

export const repairPagesWithBlockString = async (
  pages: PageWithBlockString[],
): Promise<PageRepairResult> => {
  const failures: PageRepairResult["failures"] = [];
  for (const page of pages) {
    try {
      await repairPage(page);
    } catch (error) {
      failures.push({ title: page.title, error: getErrorMessage(error) });
    }
  }
  return { repaired: pages.length - failures.length, failures };
};
