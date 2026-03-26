import ReactDOM from "react-dom";
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
import { setInitialQueryPages } from "./utils/setQueryPages";
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
import { initPostHog } from "./utils/posthog";
import { initSchema } from "./components/settings/utils/init";
import {
  getFeatureFlag,
  getPersonalSetting,
} from "./components/settings/utils/accessors";
import { PERSONAL_KEYS } from "./components/settings/utils/settingKeys";
import { setupPullWatchOnSettingsPage } from "./components/settings/utils/pullWatchers";
import {
  onSettingChange,
  settingKeys,
} from "./components/settings/utils/settingsEmitter";
import { mountLeftSidebar } from "./components/LeftSidebarView";

export const DEFAULT_CANVAS_PAGE_FORMAT = "Canvas/*";

export default runExtension(async (onloadArgs) => {
  console.time("[DG Perf] Total init");

  console.time("[DG Perf] initPostHog");
  const isEncrypted = window.roamAlphaAPI.graph.isEncrypted;
  const isOffline = window.roamAlphaAPI.graph.type === "offline";
  const disallowDiagnostics = getPersonalSetting<boolean>([
    PERSONAL_KEYS.disableProductDiagnostics,
  ]);
  if (!isEncrypted && !isOffline && !disallowDiagnostics) {
    initPostHog();
  }
  console.timeEnd("[DG Perf] initPostHog");

  console.time("[DG Perf] initFeedbackWidget");
  initFeedbackWidget();
  console.timeEnd("[DG Perf] initFeedbackWidget");

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

  console.time("[DG Perf] initializeDiscourseNodes");
  await initializeDiscourseNodes();
  console.timeEnd("[DG Perf] initializeDiscourseNodes");

  console.time("[DG Perf] refreshConfigTree");
  refreshConfigTree();
  console.timeEnd("[DG Perf] refreshConfigTree");

  console.time("[DG Perf] addGraphViewNodeStyling");
  addGraphViewNodeStyling();
  console.timeEnd("[DG Perf] addGraphViewNodeStyling");

  console.time("[DG Perf] registerCommandPaletteCommands");
  registerCommandPaletteCommands(onloadArgs);
  console.timeEnd("[DG Perf] registerCommandPaletteCommands");

  console.time("[DG Perf] createSettingsPanel");
  createSettingsPanel(onloadArgs);
  console.timeEnd("[DG Perf] createSettingsPanel");

  console.time("[DG Perf] registerSmartBlock");
  registerSmartBlock(onloadArgs);
  console.timeEnd("[DG Perf] registerSmartBlock");

  console.time("[DG Perf] setInitialQueryPages");
  setInitialQueryPages(onloadArgs);
  console.timeEnd("[DG Perf] setInitialQueryPages");

  console.time("[DG Perf] styles injection");
  const style = addStyle(styles);
  const discourseGraphStyle = addStyle(discourseGraphStyles);
  const settingsStyle = addStyle(settingsStyles);
  const discourseFloatingMenuStyle = addStyle(discourseFloatingMenuStyles);

  const isStreamlineStylingEnabled = getPersonalSetting<boolean>([
    PERSONAL_KEYS.streamlineStyling,
  ]);
  let streamlineStyleElement: HTMLStyleElement | null = null;
  if (isStreamlineStylingEnabled) {
    streamlineStyleElement = addStyle(streamlineStyling);
    streamlineStyleElement.id = "streamline-styling";
  }
  console.timeEnd("[DG Perf] styles injection");

  console.time("[DG Perf] initObservers");
  const { observers, listeners, cleanups } = initObservers({ onloadArgs });
  console.timeEnd("[DG Perf] initObservers");

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

  if (getFeatureFlag("Suggestive mode enabled")) {
    initializeSupabaseSync();
  }

  const unsubSuggestiveMode = onSettingChange(
    settingKeys.suggestiveModeEnabled,
    (newValue) => {
      if (newValue) {
        initializeSupabaseSync();
      } else {
        setSyncActivity(false);
      }
    },
  );

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
    listActiveQueries: () => listActiveQueries(),
    isDiscourseNode: isDiscourseNode,
    // @ts-expect-error - we are still using roamjs-components global definition
    getDiscourseNodes: getDiscourseNodes,
  };

  console.time("[DG Perf] installDiscourseFloatingMenu");
  installDiscourseFloatingMenu(onloadArgs);
  console.timeEnd("[DG Perf] installDiscourseFloatingMenu");

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

  const unsubLeftSidebarFlag = onSettingChange(
    settingKeys.leftSidebarFlag,
    (newValue) => {
      const enabled = Boolean(newValue);
      const wrapper = document.querySelector<HTMLDivElement>(
        ".starred-pages-wrapper",
      );
      if (!wrapper) return;
      if (enabled) {
        wrapper.style.padding = "0";
        void mountLeftSidebar(wrapper, onloadArgs);
      } else {
        const root = wrapper.querySelector("#dg-left-sidebar-root");
        if (root) {
          // eslint-disable-next-line react/no-deprecated
          ReactDOM.unmountComponentAtNode(root);
          root.remove();
        }
        wrapper.style.padding = "";
      }
    },
  );

  console.time("[DG Perf] initSchema");
  const { blockUids } = await initSchema();
  console.timeEnd("[DG Perf] initSchema");

  console.time("[DG Perf] setupPullWatchOnSettingsPage");
  const cleanupPullWatchers = setupPullWatchOnSettingsPage(blockUids);
  console.timeEnd("[DG Perf] setupPullWatchOnSettingsPage");

  console.timeEnd("[DG Perf] Total init");

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
      unsubLeftSidebarFlag();
      unsubSuggestiveMode();
      cleanupPullWatchers();
      cleanups.forEach((fn) => fn());
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
