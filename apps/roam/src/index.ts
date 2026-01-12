import { addStyle } from "roamjs-components/dom";
import { render as renderToast } from "roamjs-components/components/Toast";
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
import { getSetting } from "./utils/extensionSettings";
import { initPostHog } from "./utils/posthog";
import {
  STREAMLINE_STYLING_KEY,
  DISALLOW_DIAGNOSTICS,
} from "./data/userSettings";
import { getFeatureFlag } from "./components/settings/utils/accessors";

export const DEFAULT_CANVAS_PAGE_FORMAT = "Canvas/*";

export default runExtension(async (onloadArgs) => {
  const isEncrypted = window.roamAlphaAPI.graph.isEncrypted;
  const isOffline = window.roamAlphaAPI.graph.type === "offline";
  const disallowDiagnostics = getSetting(DISALLOW_DIAGNOSTICS, false);
  if (!isEncrypted && !isOffline && !disallowDiagnostics) {
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

  // For testing purposes
  // await initSchema();
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

  // Initialize sync if suggestive mode was already enabled before plugin load
  // (pull watcher handles reactive changes after this)
  if (getFeatureFlag("Suggestive Mode Enabled")) {
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
