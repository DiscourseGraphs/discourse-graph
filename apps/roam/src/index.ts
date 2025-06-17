import { addStyle } from "roamjs-components/dom";
import { render as renderToast } from "roamjs-components/components/Toast";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import { runExtension } from "roamjs-components/util";
import { queryBuilderLoadedToast } from "./data/toastMessages";
import runQuery from "./utils/runQuery";
import isDiscourseNode from "./utils/isDiscourseNode";
import { fireQuerySync } from "./utils/fireQuery";
import parseQuery from "./utils/parseQuery";
import refreshConfigTree from "./utils/refreshConfigTree";
import { registerCommandPaletteCommands } from "./utils/registerCommandPaletteCommands";
import { createSettingsPanel } from "~/utils/createSettingsPanel";
import { listActiveQueries } from "./utils/listActiveQueries";
import { registerSmartBlock } from "./utils/registerSmartBlock";
import { initObservers } from "./utils/initializeObserversAndListeners";
import { addGraphViewNodeStyling } from "./utils/graphViewNodeStyling";
import { setQueryPages } from "./utils/setQueryPages";
import initializeDiscourseNodes from "./utils/initializeDiscourseNodes";
import styles from "./styles/styles.css";
import settingsStyles from "./styles/settingsStyles.css";
import discourseGraphStyles from "./styles/discourseGraphStyles.css";
import textSelectionPopupStyles from "./styles/textSelectionPopup.css";
import posthog from "posthog-js";
import getDiscourseNodes from "./utils/getDiscourseNodes";
import { initFeedbackWidget } from "./components/BirdEatsBugs";

const initPostHog = () => {
  posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    autocapture: false,
    property_denylist: [
      "$ip", // Still seeing ip in the event
      "$device_id",
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
  const isEncrypted = window.roamAlphaAPI.graph.isEncrypted;
  const isOffline = window.roamAlphaAPI.graph.type === "offline";
  if (!isEncrypted && !isOffline) {
    initPostHog();
    const userUid = getCurrentUserUid();
    const graphName = window.roamAlphaAPI.graph.name;
    posthog.identify(userUid, {
      graphName,
    });
    posthog.capture("Extension Loaded", {
      graphName,
      userUid,
    });
  }

  initFeedbackWidget(onloadArgs.extensionAPI);

  if (window?.roamjs?.loaded?.has("query-builder")) {
    renderToast({
      timeout: 10000,
      id: "query-builder-loaded",
      content: queryBuilderLoadedToast,
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

  initializeDiscourseNodes();
  refreshConfigTree();
  addGraphViewNodeStyling();
  registerCommandPaletteCommands(onloadArgs);
  createSettingsPanel(onloadArgs);
  registerSmartBlock(onloadArgs);
  setQueryPages(onloadArgs);
  const style = addStyle(styles);
  const discourseGraphStyle = addStyle(discourseGraphStyles);
  const settingsStyle = addStyle(settingsStyles);
  const textSelectionPopupStyle = addStyle(textSelectionPopupStyles);

  const { observers, listeners } = await initObservers({ onloadArgs });
  const {
    pageActionListener,
    hashChangeListener,
    nodeMenuTriggerListener,
    discourseNodeSearchTriggerListener,
    selectionChangeListener,
    documentClickListener,
  } = listeners;
  document.addEventListener("roamjs:query-builder:action", pageActionListener);
  window.addEventListener("hashchange", hashChangeListener);
  document.addEventListener("keydown", nodeMenuTriggerListener);
  document.addEventListener("input", discourseNodeSearchTriggerListener);
  document.addEventListener("selectionchange", selectionChangeListener);
  document.addEventListener("mousedown", documentClickListener);

  const { extensionAPI } = onloadArgs;
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
    // @ts-ignore - we are still using roamjs-components global definition
    getDiscourseNodes: getDiscourseNodes,
  };

  return {
    elements: [
      style,
      settingsStyle,
      discourseGraphStyle,
      textSelectionPopupStyle,
    ],
    observers: observers,
    unload: () => {
      window.roamjs.extension?.smartblocks?.unregisterCommand("QUERYBUILDER");
      // @ts-ignore - tldraw throws a warning on multiple loads
      delete window[Symbol.for("__signia__")];
      document.removeEventListener(
        "roamjs:query-builder:action",
        pageActionListener,
      );
      window.removeEventListener("hashchange", hashChangeListener);
      document.removeEventListener("keydown", nodeMenuTriggerListener);
      document.removeEventListener("input", discourseNodeSearchTriggerListener);
      document.removeEventListener("selectionchange", selectionChangeListener);
      document.removeEventListener("mousedown", documentClickListener);
      window.roamAlphaAPI.ui.graphView.wholeGraph.removeCallback({
        label: "discourse-node-styling",
      });
    },
  };
});
