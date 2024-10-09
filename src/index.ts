import type { InputTextNode } from "roamjs-components/types/native";
import {
  addStyle,
  createHTMLObserver,
  createButtonObserver,
  getPageTitleValueByHtmlElement,
} from "roamjs-components/dom";
import { createBlock } from "roamjs-components/writes";

import { runExtension, extractRef } from "roamjs-components/util";
import registerSmartBlocksCommand from "roamjs-components/util/registerSmartBlocksCommand";

import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";

import { renderTldrawCanvas } from "./components/Tldraw/Tldraw";
import { renderQueryPage, renderQueryBlock } from "./components/QueryBuilder";

import runQuery from "./utils/runQuery";
import resolveQueryBuilderRef from "./utils/resolveQueryBuilderRef";
import isDiscourseNode from "./utils/isDiscourseNode";
import { fireQuerySync } from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";

import initializeDiscourseGraphsMode from "./discourseGraphsMode";
import styles from "./styles/styles.css";
import settingsStyles from "./styles/settingsStyles.css";

import { registerCommandPaletteCommands } from "./settings/commandPalette";
import { createSettingsPanel } from "./settings/settingsPanel";

import { renderNodeConfigPage } from "./settings/configPages";
import { isCanvasPage as checkIfCanvasPage } from "./utils/isCanvasPage";
import { isQueryPage } from "./utils/isQueryPage";
import { listActiveQueries } from "./utils/listActiveQueries";

export const DEFAULT_CANVAS_PAGE_FORMAT = "Canvas/*";

export default runExtension(async (onloadArgs) => {
  const { extensionAPI } = onloadArgs;
  const style = addStyle(styles);
  const settingsStyle = addStyle(settingsStyles);

  const cleanupDiscourseGraphs = await initializeDiscourseGraphsMode(
    onloadArgs
  );

  // Observers and Listeners
  const isDiscourseNodePage = (title: string) =>
    title.startsWith("discourse-graph/nodes/");
  const isCanvasPage = ({
    title,
    h1,
  }: {
    title: string;
    h1: HTMLHeadingElement;
  }) =>
    checkIfCanvasPage({ title, extensionAPI }) && !!h1.closest(".roam-article");

  const pageTitleObserver = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => {
      const h1 = e as HTMLHeadingElement;
      const title = getPageTitleValueByHtmlElement(h1);
      const props = { title, h1, onloadArgs };

      if (isDiscourseNodePage(title)) renderNodeConfigPage(props);
      else if (isQueryPage(props)) renderQueryPage(props);
      else if (isCanvasPage(props)) renderTldrawCanvas(props);
    },
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
    listActiveQueries: () => listActiveQueries(extensionAPI),
    isDiscourseNode: isDiscourseNode,
  };

  // Command Palette and Roam Settings
  registerCommandPaletteCommands(onloadArgs);
  createSettingsPanel(extensionAPI);

  return {
    elements: [style, settingsStyle],
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
