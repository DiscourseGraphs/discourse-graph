import {
  addStyle,
  createHTMLObserver,
  createButtonObserver,
  getPageTitleValueByHtmlElement,
} from "roamjs-components/dom";
import { createBlock } from "roamjs-components/writes";
import { render as renderToast } from "roamjs-components/components/Toast";

import { runExtension } from "roamjs-components/util";

import { renderTldrawCanvas } from "./components/canvas/Tldraw";
import { renderQueryPage, renderQueryBlock } from "./components/QueryBuilder";
import { QueryBuilderLoadedToast } from "./components/toastMessages";

import runQuery from "./utils/runQuery";
import isDiscourseNode from "./utils/isDiscourseNode";
import { fireQuerySync } from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";

import initializeDiscourseGraphsMode from "./discourseGraphsMode";
import styles from "./styles/styles.css";
import settingsStyles from "./styles/settingsStyles.css";

import { registerCommandPaletteCommands } from "./settings/commandPalette";
import { createSettingsPanel } from "./settings/settingsPanel";

import { renderNodeConfigPage } from "./settings/configPages";
import { isCurrentPageCanvas as isCanvasPage } from "./utils/isCanvasPage";
import { isDiscourseNodeConfigPage as isNodeConfigPage } from "./utils/isDiscourseNodeConfigPage";
import { isQueryPage } from "./utils/isQueryPage";
import { listActiveQueries } from "./utils/listActiveQueries";
import { registerSmartBlock } from "./utils/registerSmartBlock";
import isFlagEnabled from "./utils/isFlagEnabled";

import {
  enablePageRefObserver,
  addPageRefObserver,
  getPageRefObserversSize,
  previewPageRefHandler,
  overlayPageRefHandler,
} from "./utils/pageRefObserverHandlers";
import posthog from "posthog-js";

const initPostHog = () => {
  console.log("PostHog initialized");

  posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    property_denylist: [
      "$ip", // Still seeing ip in the event
      "$device_id",
      "$initial_person_info",
      "$geoip_city_name",
      "$geoip_latitude",
      "$geoip_longitude",
      "$geoip_postal_code",
      "$geoip_subdivision_1_name",
      "$raw_user_agent",
      "$current_url",
      "$referrer",
      "$referring_domain",
      "$initial_current_url",
      "$pathname",
    ],
  });
};

export const DEFAULT_CANVAS_PAGE_FORMAT = "Canvas/*";

export default runExtension(async (onloadArgs) => {
  initPostHog();
  if (window?.roamjs?.loaded?.has("query-builder")) {
    renderToast({
      timeout: 10000,
      id: "query-builder-loaded",
      content: QueryBuilderLoadedToast(),
      intent: "danger",
    });
    return;
  }

  if (process.env.NODE_ENV === "development") {
    renderToast({
      id: "discourse-graph-loaded",
      content: "Successfully loaded",
      intent: "success",
      timeout: 500,
    });
  }
  const { extensionAPI } = onloadArgs;
  const style = addStyle(styles);
  const settingsStyle = addStyle(settingsStyles);

  const cleanupDiscourseGraphs =
    await initializeDiscourseGraphsMode(onloadArgs);

  // Observers and Listeners
  const pageTitleObserver = createHTMLObserver({
    tag: "H1",
    className: "rm-title-display",
    callback: (e) => {
      const h1 = e as HTMLHeadingElement;
      const title = getPageTitleValueByHtmlElement(h1);
      const props = { title, h1, onloadArgs };

      if (isNodeConfigPage(title)) renderNodeConfigPage(props);
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
    }>,
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

  if (isFlagEnabled("preview")) addPageRefObserver(previewPageRefHandler);
  if (isFlagEnabled("grammar.overlay")) {
    addPageRefObserver((s) => overlayPageRefHandler(s, onloadArgs));
  }
  if (!!getPageRefObserversSize()) enablePageRefObserver();

  // Window
  // @ts-ignore
  window.roamjs.extension.queryBuilder = {
    runQuery: (parentUid: string) =>
      runQuery({ parentUid, extensionAPI }).then(
        ({ allProcessedResults }) => allProcessedResults,
      ),
    runQuerySync: (parentUid: string) => {
      const queryArgs = parseQuery(parentUid);
      return fireQuerySync(queryArgs);
    },
    listActiveQueries: () => listActiveQueries(extensionAPI),
    isDiscourseNode: isDiscourseNode,
  };

  registerCommandPaletteCommands(onloadArgs);
  createSettingsPanel(onloadArgs);
  registerSmartBlock(extensionAPI);

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
        pageActionListener,
      );
    },
  };
});
