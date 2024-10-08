import type {
  InputTextNode,
  OnloadArgs,
  PullBlock,
} from "roamjs-components/types/native";
import {
  addStyle,
  createHTMLObserver,
  createButtonObserver,
  getUidsFromId,
  getPageTitleValueByHtmlElement,
  getBlockUidFromTarget,
  getCurrentPageUid,
} from "roamjs-components/dom";
import { createBlock, createPage, updateBlock } from "roamjs-components/writes";

import { runExtension, extractRef } from "roamjs-components/util";
import registerSmartBlocksCommand from "roamjs-components/util/registerSmartBlocksCommand";

import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

import { render as renderToast } from "roamjs-components/components/Toast";

import { render as queryRender } from "./components/QueryDrawer";
import { renderTldrawCanvas } from "./components/Tldraw/Tldraw";
import { openCanvasDrawer } from "./components/Tldraw/CanvasDrawer";
import DefaultFilters from "./components/settings/DefaultFilters";
import { render as exportRender } from "./components/Export";
import { renderQueryPage, renderQueryBlock } from "./components/QueryBuilder";
import QueryPagesPanel, {
  getQueryPages,
} from "./components/settings/QueryPagesPanel";

import runQuery from "./utils/runQuery";
import resolveQueryBuilderRef from "./utils/resolveQueryBuilderRef";
import isDiscourseNode from "./utils/isDiscourseNode";
import { fireQuerySync } from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";

import initializeDiscourseGraphsMode from "./discourseGraphsMode";
import styles from "./styles/styles.css";
import { registerCommandPaletteCommands } from "./settings/commandPalette";
import { createSettingsPanel } from "./settings/settingsPanel";
import { renderDiscourseNodeTypeConfigPage } from "./settings/configPages";
import { isCanvasPage } from "./utils/isCanvasPage";

export const DEFAULT_CANVAS_PAGE_FORMAT = "Canvas/*";

export default runExtension(async (onloadArgs) => {
  const { extensionAPI } = onloadArgs;
  const style = addStyle(styles);

  const cleanupDiscourseGraphs = await initializeDiscourseGraphsMode(
    onloadArgs
  );

  // Observers and Listeners
  const isDiscourseNodePage = (title: string) =>
    title.startsWith("discourse-graph/nodes/");

  const isCanvasPageInArticle = ({
    title,
    h1,
  }: {
    title: string;
    h1: HTMLHeadingElement;
  }) => isCanvasPage({ title, extensionAPI }) && !!h1.closest(".roam-article");
  const isQueryPage = (title: string): boolean => {
    return getQueryPages(extensionAPI)
      .map(
        (t) =>
          new RegExp(`^${t.replace(/\*/g, ".*").replace(/([()])/g, "\\$1")}$`)
      )
      .some((r) => r.test(title));
  };
  const renderPageContent = (h1: HTMLHeadingElement) => {
    const title = getPageTitleValueByHtmlElement(h1);
    const props = { title, h1, onloadArgs };
    if (isDiscourseNodePage(title)) renderDiscourseNodeTypeConfigPage(props);
    else if (isQueryPage(title)) renderQueryPage(props);
    else if (isCanvasPageInArticle(props)) renderTldrawCanvas(props);
  };
  const pageTitleObserver = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => renderPageContent(e as HTMLHeadingElement),
  });

  const queryBlockObserver = createButtonObserver({
    attribute: "query-block",
    render: (b) => renderQueryBlock(b, onloadArgs),
  });

  const pageActionListener = ((
    e: CustomEvent<{
      action: string;
      uid: string;
      val: string;
      onRefresh: () => void;
    }>
  ) => {
    if (!/page/i.test(e.detail.action)) return;
    window.roamAlphaAPI.ui.mainWindow
      .getOpenPageOrBlockUid()
      .then((u) => u || window.roamAlphaAPI.util.dateToPageUid(new Date()))
      .then((parentUid) => {
        createBlock({
          parentUid,
          order: Number.MAX_VALUE,
          node: { text: `[[${e.detail.val}]]` },
        });
      });
  }) as EventListener;
  document.addEventListener("roamjs:query-builder:action", pageActionListener);

  // SmartBlocks Command
  registerSmartBlocksCommand({
    text: "QUERYBUILDER",
    delayArgs: true,
    help: "Run an existing query block and output the results.\n\n1. The reference to the query block\n2. The format to output each result\n3. (Optional) The number of results returned",
    handler: ({ proccessBlockText, variables, processBlock }) =>
      function runQueryBuilderCommand(arg, ...args) {
        const inputArgs = args.filter((a) => a.includes("="));
        const regularArgs = args.filter((a) => !a.includes("="));
        const lastArg = regularArgs[regularArgs.length - 1];
        const lastArgIsLimitArg = !Number.isNaN(Number(lastArg));
        const { format: formatArg, limit } = lastArgIsLimitArg
          ? {
              format: regularArgs.slice(0, -1).join(","),
              limit: Number(lastArg),
            }
          : { format: regularArgs.join(","), limit: 0 };
        const formatArgAsUid = extractRef(formatArg);
        const format = isLiveBlock(formatArgAsUid)
          ? {
              text: getTextByBlockUid(formatArgAsUid),
              children: getBasicTreeByParentUid(formatArgAsUid),
              uid: formatArgAsUid,
            }
          : { text: formatArg, children: [], uid: "" };
        const queryRef = variables[arg] || arg;
        const parentUid = resolveQueryBuilderRef({ queryRef, extensionAPI });
        return runQuery({
          parentUid,
          extensionAPI,
          inputs: Object.fromEntries(
            inputArgs
              .map((i) => i.split("=").slice(0, 2) as [string, string])
              .map(([k, v]) => [k, variables[v] || v])
          ),
        }).then(({ allProcessedResults }) => {
          const results = limit
            ? allProcessedResults.slice(0, limit)
            : allProcessedResults;
          return results
            .map((r) =>
              Object.fromEntries(
                Object.entries(r).map(([k, v]) => [
                  k.toLowerCase(),
                  typeof v === "string"
                    ? v
                    : typeof v === "number"
                    ? v.toString()
                    : v instanceof Date
                    ? window.roamAlphaAPI.util.dateToPageTitle(v)
                    : "",
                ])
              )
            )
            .flatMap((r) => {
              if (processBlock && format.uid) {
                const blockFormatter = (node: InputTextNode) => () => {
                  Object.entries(r).forEach(([k, v]) => {
                    variables[k] = v;
                  });
                  return processBlock(node);
                };
                return format.text
                  ? blockFormatter(format)
                  : format.children.map(blockFormatter);
              }

              const s = format.text.replace(
                /{([^}]+)}/g,
                (_, i: string) => r[i.toLowerCase()]
              );
              return [() => proccessBlockText(s)];
            })
            .reduce(
              (prev, cur) => prev.then((p) => cur().then((c) => p.concat(c))),
              Promise.resolve([] as InputTextNode[])
            );
        });
      },
  });

  // Window
  // @ts-ignore
  window.roamjs.extension.queryBuilder = {
    runQuery: (parentUid: string) =>
      runQuery({ parentUid, extensionAPI }).then(
        ({ allProcessedResults }) => allProcessedResults
      ),
    runQuerySync: (parentUid: string) => {
      const queryArgs = parseQuery(parentUid);
      return fireQuerySync(queryArgs);
    },
    listActiveQueries: () =>
      (
        window.roamAlphaAPI.data.fast.q(
          `[:find (pull ?b [:block/uid]) :where [or-join [?b] 
                 [and [?b :block/string ?s] [[clojure.string/includes? ?s "{{query block}}"]] ]
                 ${getQueryPages(extensionAPI).map(
                   (p) =>
                     `[and [?b :node/title ?t] [[re-pattern "^${p.replace(
                       /\*/,
                       ".*"
                     )}$"] ?regex] [[re-find ?regex ?t]]]`
                 )}
            ]]`
        ) as [PullBlock][]
      ).map((b) => ({ uid: b[0][":block/uid"] || "" })),
    isDiscourseNode: isDiscourseNode,
  };

  // Command Palette and Roam Settings
  registerCommandPaletteCommands(onloadArgs);
  createSettingsPanel(extensionAPI);

  return {
    elements: [style],
    observers: [pageTitleObserver, queryBlockObserver],
    unload: () => {
      window.roamjs.extension?.smartblocks?.unregisterCommand("QUERYBUILDER");
      cleanupDiscourseGraphs();
      // @ts-ignore - tldraw throws a warning on multiple loads
      delete window[Symbol.for("__signia__")];
      document.removeEventListener(
        "roamjs:query-builder:action",
        pageActionListener
      );
    },
  };
});
