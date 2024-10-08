import createButtonObserver from "roamjs-components/dom/createButtonObserver";
import createHTMLObserver from "roamjs-components/dom/createHTMLObserver";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUidsFromId from "roamjs-components/dom/getUidsFromId";
import { renderQueryBuilder } from "./components/QueryBuilder";
import runExtension from "roamjs-components/util/runExtension";
import addStyle from "roamjs-components/dom/addStyle";
import getPageTitleValueByHtmlElement from "roamjs-components/dom/getPageTitleValueByHtmlElement";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import {
  render as renderQueryPage,
  renderQueryBlock,
} from "./components/QueryPage";
import DefaultFilters from "./components/DefaultFilters";
import registerSmartBlocksCommand from "roamjs-components/util/registerSmartBlocksCommand";
import extractRef from "roamjs-components/util/extractRef";
import type { InputTextNode, PullBlock } from "roamjs-components/types/native";
import QueryPagesPanel, { getQueryPages } from "./components/QueryPagesPanel";
import runQuery from "./utils/runQuery";
import updateBlock from "roamjs-components/writes/updateBlock";
import getChildrenLengthByPageUid from "roamjs-components/queries/getChildrenLengthByPageUid";
import createBlock from "roamjs-components/writes/createBlock";
import initializeDiscourseGraphsMode, {
  renderDiscourseNodeTypeConfigPage,
  renderPlayground,
  SETTING,
} from "./discourseGraphsMode";
import { render as queryRender } from "./components/QueryDrawer";
import createPage from "roamjs-components/writes/createPage";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import { renderTldrawCanvas } from "./components/tldraw/Tldraw";
import { QBGlobalRefs } from "./utils/types";
import localStorageSet from "roamjs-components/util/localStorageSet";
import localStorageGet from "roamjs-components/util/localStorageGet";
import localStorageRemove from "roamjs-components/util/localStorageRemove";
import { getNodeEnv } from "roamjs-components/util/env";
import resolveQueryBuilderRef from "./utils/resolveQueryBuilderRef";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import { render as renderToast } from "roamjs-components/components/Toast";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import { openCanvasDrawer } from "./components/tldraw/CanvasDrawer";
import isDiscourseNode from "./utils/isDiscourseNode";
import { fireQuerySync } from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";
import { render as exportRender } from "./components/Export";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";

export const DEFAULT_CANVAS_PAGE_FORMAT = "Canvas/*";

export default runExtension(async (onloadArgs) => {
  const { extensionAPI } = onloadArgs;
  const style = addStyle(`.bp3-button:focus {
    outline-width: 2px;
}

.roamjs-item-dirty, 
.roamjs-item-dirty.bp3-menu-item .bp3-icon, 
.roamjs-item-dirty.bp3-button .bp3-icon {
  color: #a82a2a;
}

.roamjs-query-condition-type,
.roamjs-query-condition-source, 
.roamjs-query-condition-relation,
.roamjs-query-return-node {
  min-width: 144px;
  max-width: 144px;
}

.roamjs-query-condition-relation,
.roamjs-query-return-node,
.roamjs-query-condition-target {
  padding-right: 8px;
}

.roamjs-query-condition-target { 
  flex-grow: 1;
  min-width: 240px;
}

.roamjs-query-condition-relation .bp3-popover-target,
.roamjs-query-condition-target .roamjs-autocomplete-input-target { 
  width: 100%
}

.roamjs-query-hightlighted-result {
  background: #FFFF00;
}

.roamjs-query-embed .rm-block-separator {
  display: none;
}

.roamjs-query-embed span.bp3-popover-target {
  display: inline-block;
}

.roamjs-query-embed > .page-embed {
  margin-left: 24px;
}

/* width */
.roamjs-query-results-view ul::-webkit-scrollbar {
  width: 6px;
}

/* Handle */
.roamjs-query-results-view ul::-webkit-scrollbar-thumb {
  background: #888;
}

.roamjs-query-builder-parent .roamjs-edit-component {
  display: none;
}

.roamjs-query-results-view thead td .bp3-button,
.roamjs-query-results-view thead td .bp3-button svg,
.roamjs-query-results-view thead td .bp3-icon svg  {
  width: 12px;
  height: 12px;
  min-width: 12px;
  min-height: 12px;
}

.roamjs-query-results-view table.bp3-html-table td {
  padding: 8px;
}

.roamjs-view-select button {
  width: 100%;
  display: flex;
  justify-content: space-between;
}

.roamjs-view-select {
  flex: 1;
}

.roamjs-view-select > span {
  width: 100%;
}

svg.rs-svg-container {
  overflow: visible;
}

.roamjs-tldraw-node .rm-api-render--block .rm-block__controls,
.rs-shape .rm-api-render--block .rm-block__ref-count {
  display: none;
}


.roamjs-kanban-container .roamjs-kanban-column {
  width: inherit;
}

.roamjs-kanban-container .roamjs-kanban-column .rm-block-separator {
  display:none;
}
.roamjs-extra-row td {
  position: relative;
  background-color: #F5F8FA;
  padding: 16px;
  max-height: 240px;
  overflow-y: scroll;
}

.roamjs-export-dialog-body .bp3-tab-list {
  padding: 10px 20px;
  border-bottom: 1px solid rgba(16,22,26,0.15);
}

.roamjs-kanban-card .card-selections tr:first-child td {
  box-shadow: none;
}
.roamjs-query-results-view .roamjs-kanban-card .card-selections table.bp3-html-table td {
  padding: 0.50rem;
}
.roamjs-query-column-views .bp3-running-text table th,
.roamjs-query-column-views table.bp3-html-table th, 
.roamjs-query-column-views .bp3-running-text table td, 
.roamjs-query-column-views table.bp3-html-table td {
  vertical-align: initial;
}
`);
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
    } else if (
      title.startsWith("Playground") &&
      !!h1.closest(".roam-article")
    ) {
      renderPlayground(title, globalRefs);
    } else if (isCanvasPage(title) && !!h1.closest(".roam-article")) {
      renderTldrawCanvas(title, onloadArgs);
    }
  };
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
      {
        id: SETTING,
        name: "Discourse Graphs Enabled",
        description:
          "Includes the ability to construct higher level discourse graph nodes and relations for higher order reasoning.",
        action: {
          type: "switch",
          onChange: (e) => {
            const flag = e.target.checked;
            toggleDiscourseGraphsMode(flag).then(() => {
              if (flag) {
                document
                  .querySelectorAll<HTMLHeadingElement>(`h1.rm-title-display`)
                  .forEach(h1ObserverCallback);
              }
              if (getNodeEnv() === "development") {
                if (flag) {
                  localStorageSet(SETTING, "true");
                } else {
                  localStorageRemove(SETTING);
                }
              }
            });
          },
        },
      },
    ],
  });
  const toggleDiscourseGraphsMode = await initializeDiscourseGraphsMode(
    onloadArgs
  );
  if (getNodeEnv() === "development" && localStorageGet(SETTING)) {
    extensionAPI.settings.set(SETTING, true);
    toggleDiscourseGraphsMode(true);
  }

  const globalRefs: QBGlobalRefs = {
    clearOnClick: ({ parentUid, text }) => {
      const order = getChildrenLengthByPageUid(parentUid);
      createBlock({ parentUid, node: { text }, order });
    },
  };

  const clearOnClick = async (tag: string) => {
    const uid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"] || "";
    const text = `[[${tag}]]`;
    if (uid) {
      const currentText = getTextByBlockUid(uid);
      updateBlock({
        text: `${currentText} ${text}`,
        uid,
      });
    } else {
      const parentUid = await window.roamAlphaAPI.ui.mainWindow
        .getOpenPageOrBlockUid()
        .then(
          (uid) => uid || window.roamAlphaAPI.util.dateToPageTitle(new Date())
        );
      globalRefs.clearOnClick({ parentUid, text });
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

  const dataAttribute = "data-roamjs-edit-query";
  const editQueryBuilderObserver = createHTMLObserver({
    callback: (b) => {
      if (!b.getAttribute(dataAttribute)) {
        b.setAttribute(dataAttribute, "true");
        const editButtonRoot = document.createElement("div");
        b.appendChild(editButtonRoot);
        const blockId = b.closest(".roam-block")?.id;
        const initialValue = getTextByBlockUid(getUidsFromId(blockId).blockUid);
        if (blockId) {
          renderQueryBuilder({
            blockId,
            parent: editButtonRoot,
            initialValue,
          });
          const editButton = document.getElementById(
            `roamjs-query-builder-button-${blockId}`
          );
          if (editButton)
            editButton.addEventListener("mousedown", (e) =>
              e.stopPropagation()
            );
        }
      }
    },
    tag: "DIV",
    className: "rm-query-title",
  });

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
          clearOnClick,
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

  return {
    elements: [style],
    observers: [h1Observer, editQueryBuilderObserver, queryBlockObserver],
    unload: () => {
      window.roamjs.extension?.smartblocks?.unregisterCommand("QUERYBUILDER");
      toggleDiscourseGraphsMode(false);
      // @ts-ignore - tldraw throws a warning on multiple loads
      delete window[Symbol.for("__signia__")];
      document.removeEventListener(
        "roamjs:query-builder:action",
        pageActionListener
      );
    },
  };
});
