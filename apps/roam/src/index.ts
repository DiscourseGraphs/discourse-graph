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
import discourseFloatingMenuStyles from "./styles/discourseFloatingMenuStyles.css";
import settingsStyles from "./styles/settingsStyles.css";
import discourseGraphStyles from "./styles/discourseGraphStyles.css";
import streamlineStyling from "./styles/streamlineStyling";
import posthog from "posthog-js";
import getDiscourseNodes from "./utils/getDiscourseNodes";
import { initFeedbackWidget } from "./components/BirdEatsBugs";
import {
  installDiscourseFloatingMenu,
  removeDiscourseFloatingMenu,
} from "./components/DiscourseFloatingMenu";
import {
  initializeSupabaseSync,
  setSyncActivity,
} from "./utils/syncDgNodesToSupabase";
import { initPluginTimer } from "./utils/pluginTimer";
import { getUidAndBooleanSetting } from "./utils/getExportSettings";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "./utils/renderNodeConfigPage";
import { getSetting } from "./utils/extensionSettings";
import { STREAMLINE_STYLING_KEY } from "./data/userSettings";
import { getVersionWithDate } from "~/utils/getVersion";

const initPostHog = () => {
  posthog.init("phc_SNMmBqwNfcEpNduQ41dBUjtGNEUEKAy6jTn63Fzsrax", {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    autocapture: false,
    loaded: (posthog) => {
      const { version, buildDate } = getVersionWithDate();
      const userUid = getCurrentUserUid();
      const graphName = window.roamAlphaAPI.graph.name;
      posthog.identify(userUid, {
        graphName,
      });
      posthog.register({
        version: version || "-",
        buildDate: buildDate || "-",
        graphName,
      });
      posthog.capture("Extension Loaded");
    },
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
  }

  initFeedbackWidget();

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

  initPluginTimer();

  await initializeDiscourseNodes();
  refreshConfigTree();

  addGraphViewNodeStyling();
  registerCommandPaletteCommands(onloadArgs);
  createSettingsPanel(onloadArgs);
  registerSmartBlock(onloadArgs);
  setQueryPages(onloadArgs);

  const style = addStyle(styles);
  const discourseGraphStyle = addStyle(discourseGraphStyles);
  const settingsStyle = addStyle(settingsStyles);
  const discourseFloatingMenuStyle = addStyle(discourseFloatingMenuStyles);

  // Add streamline styling only if enabled
  const isStreamlineStylingEnabled = getSetting(STREAMLINE_STYLING_KEY, false);
  let streamlineStyleElement: HTMLStyleElement | null = null;
  if (isStreamlineStylingEnabled) {
    streamlineStyleElement = addStyle(streamlineStyling);
    streamlineStyleElement.id = "streamline-styling";
  }

  const { observers, listeners } = await initObservers({ onloadArgs });
  const {
    pageActionListener,
    hashChangeListener,
    nodeMenuTriggerListener,
    discourseNodeSearchTriggerListener,
    nodeCreationPopoverListener,
  } = listeners;
  document.addEventListener("roamjs:query-builder:action", pageActionListener);
  window.addEventListener("hashchange", hashChangeListener);
  document.addEventListener("keydown", nodeMenuTriggerListener);
  document.addEventListener("input", discourseNodeSearchTriggerListener);
  document.addEventListener("selectionchange", nodeCreationPopoverListener);

  const isSuggestiveModeEnabled = getUidAndBooleanSetting({
    tree: getBasicTreeByParentUid(
      getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE),
    ),
    text: "(BETA) Suggestive Mode Enabled",
  }).value;

  if (isSuggestiveModeEnabled) {
    initializeSupabaseSync();
  }

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
    // @ts-expect-error - we are still using roamjs-components global definition
    getDiscourseNodes: getDiscourseNodes,
  };

  installDiscourseFloatingMenu(onloadArgs);

  const leftSidebarScript = document.querySelector<HTMLScriptElement>(
    'script#roam-left-sidebar[src="https://sid597.github.io/roam-left-sidebar/js/main.js"]',
  );

  if (leftSidebarScript) {
    renderToast({
      id: "discourse-graph-left-sidebar-conflict",
      intent: "warning",
      timeout: 10000,
      content:
        "Discourse Graph detected the Roam left sidebar script. Running both sidebars may cause issues. Please remove the Roam left sidebar script from your Roam instance, and reload the graph.",
    });
  }

  return {
    elements: [
      style,
      settingsStyle,
      discourseGraphStyle,
      discourseFloatingMenuStyle,
      ...(streamlineStyleElement ? [streamlineStyleElement] : []),
    ],
    observers: observers,
    unload: () => {
      setSyncActivity(false);
      window.roamjs.extension?.smartblocks?.unregisterCommand("QUERYBUILDER");
      // @ts-expect-error - tldraw throws a warning on multiple loads
      delete window[Symbol.for("__signia__")];
      document.removeEventListener(
        "roamjs:query-builder:action",
        pageActionListener,
      );
      window.removeEventListener("hashchange", hashChangeListener);
      document.removeEventListener("keydown", nodeMenuTriggerListener);
      document.removeEventListener("input", discourseNodeSearchTriggerListener);
      document.removeEventListener(
        "selectionchange",
        nodeCreationPopoverListener,
      );
      removeDiscourseFloatingMenu();
      window.roamAlphaAPI.ui.graphView.wholeGraph.removeCallback({
        label: "discourse-node-styling",
      });
    },
  };
});
