import type { InputTextNode, PullBlock } from "roamjs-components/types/native";
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
import {
  render as renderQueryPage,
  renderQueryBlock,
} from "./components/QueryPage";
import QueryPagesPanel, {
  getQueryPages,
} from "./components/settings/QueryPagesPanel";

import runQuery from "./utils/runQuery";
import resolveQueryBuilderRef from "./utils/resolveQueryBuilderRef";
import isDiscourseNode from "./utils/isDiscourseNode";
import { fireQuerySync } from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";

import initializeDiscourseGraphsMode, {
  renderDiscourseNodeTypeConfigPage,
} from "./discourseGraphsMode";
import styles from "./styles/styles.css";

export const DEFAULT_CANVAS_PAGE_FORMAT = "Canvas/*";

export default runExtension(async (onloadArgs) => {
  const { extensionAPI } = onloadArgs;
  const style = addStyle(styles);

  const cleanupDiscourseGraphs = await initializeDiscourseGraphsMode(
    onloadArgs
  );

  // Observers and Listeners
  const isCanvasPage = (title: string) => {
    const canvasPageFormat =
      (extensionAPI.settings.get("canvas-page-format") as string) ||
      DEFAULT_CANVAS_PAGE_FORMAT;
    return new RegExp(`^${canvasPageFormat}$`.replace(/\*/g, ".+")).test(title);
  };
  const h1ObserverCallback = (h1: HTMLHeadingElement) => {
    const title = getPageTitleValueByHtmlElement(h1);
    if (title.startsWith("discourse-graph/nodes/")) {
      renderDiscourseNodeTypeConfigPage({ title, h: h1, onloadArgs });
    } else if (
      getQueryPages(extensionAPI)
        .map(
          (t) =>
            new RegExp(`^${t.replace(/\*/g, ".*").replace(/([()])/g, "\\$1")}$`)
        )
        .some((r) => r.test(title))
    ) {
      const uid = getPageUidByPageTitle(title);
      const attribute = `data-roamjs-${uid}`;
      const containerParent = h1.parentElement?.parentElement;
      if (containerParent && !containerParent.hasAttribute(attribute)) {
        containerParent.setAttribute(attribute, "true");
        const parent = document.createElement("div");
        const configPageId = title.split("/").slice(-1)[0];
        parent.id = `${configPageId}-config`;
        containerParent.insertBefore(
          parent,
          h1.parentElement?.nextElementSibling || null
        );
        renderQueryPage({
          pageUid: uid,
          parent,
          onloadArgs,
        });
      }
    } else if (isCanvasPage(title) && !!h1.closest(".roam-article")) {
      renderTldrawCanvas(title, onloadArgs);
    }
  };
  const h1Observer = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => h1ObserverCallback(e as HTMLHeadingElement),
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
  extensionAPI.ui.commandPalette.addCommand({
    label: "Open Canvas Drawer",
    callback: openCanvasDrawer,
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Open Query Drawer",
    callback: () =>
      Promise.resolve(
        getPageUidByPageTitle("roam/js/query-builder/drawer") ||
          createPage({
            title: "roam/js/query-builder/drawer",
          })
      ).then((blockUid) =>
        queryRender({
          blockUid,
          onloadArgs,
        })
      ),
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Create Query Block",
    callback: async () => {
      const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
      if (!uid) {
        renderToast({
          id: "query-builder-create-block",
          content: "Must be focused on a block to create a Query Block",
        });
        return;
      }

      // setTimeout is needed because sometimes block is left blank
      setTimeout(async () => {
        await updateBlock({
          uid,
          text: "{{query block}}",
          open: false,
        });
      }, 200);

      await createBlock({
        node: {
          text: "scratch",
          children: [
            {
              text: "custom",
            },
            {
              text: "selections",
            },
            {
              text: "conditions",
              children: [
                {
                  text: "clause",
                  children: [
                    {
                      text: "source",
                      children: [{ text: "node" }],
                    },
                    {
                      text: "relation",
                    },
                  ],
                },
              ],
            },
          ],
        },
        parentUid: uid,
      });
      document.querySelector("body")?.click();
      // TODO replace with document.body.dispatchEvent(new CustomEvent)
      setTimeout(() => {
        const el = document.querySelector(`.roam-block[id*="${uid}"]`);
        const conditionEl = el?.querySelector(
          ".roamjs-query-condition-relation"
        );
        const conditionInput = conditionEl?.querySelector(
          "input"
        ) as HTMLInputElement;
        conditionInput?.focus();
      }, 200);
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Export Current Page",
    callback: () => {
      const pageUid = getCurrentPageUid();
      const pageTitle = getPageTitleByPageUid(pageUid);
      exportRender({
        results: [
          {
            uid: pageUid,
            text: pageTitle,
          },
        ],
        title: "Export Current Page",
        initialPanel: "export",
      });
    },
  });
  extensionAPI.ui.commandPalette.addCommand({
    label: "Preview Current Query Builder Results",
    callback: () => {
      const target = document.activeElement as HTMLElement;
      const uid = getBlockUidFromTarget(target);
      document.body.dispatchEvent(
        new CustomEvent("roamjs-query-builder:fire-query", { detail: uid })
      );
    },
  });
  extensionAPI.settings.panel.create({
    tabTitle: "Query Builder",
    settings: [
      {
        id: "query-pages",
        name: "Query Pages",
        description:
          "The title formats of pages that you would like to serve as pages that generate queries",
        action: {
          type: "reactComponent",
          component: QueryPagesPanel(extensionAPI),
        },
      },
      {
        id: "hide-metadata",
        name: "Hide Query Metadata",
        description: "Hide the Roam blocks that are used to power each query",
        action: {
          type: "switch",
        },
      },
      {
        id: "default-filters",
        name: "Default Filters",
        description:
          "Any filters that should be applied to your results by default",
        action: {
          type: "reactComponent",
          component: DefaultFilters(extensionAPI),
        },
      },
      {
        id: "default-page-size",
        name: "Default Page Size",
        description: "The default page size used for query results",
        action: {
          type: "input",
          placeholder: "10",
        },
      },
      {
        id: "canvas-page-format",
        name: "Canvas Page Format",
        description: "The page format for canvas pages",
        action: {
          type: "input",
          placeholder: DEFAULT_CANVAS_PAGE_FORMAT,
        },
      },
    ],
  });

  return {
    elements: [style],
    observers: [h1Observer, queryBlockObserver],
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
