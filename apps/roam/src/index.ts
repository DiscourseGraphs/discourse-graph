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
  bulkReadSettings,
  isNewSettingsStoreEnabled,
  isSyncEnabled,
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
  const pluginLoadStart = performance.now();

  refreshConfigTree();
  const settings = bulkReadSettings();

  if (!settings.personalSettings[PERSONAL_KEYS.disableProductDiagnostics]) {
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

  await initializeDiscourseNodes(settings);

  refreshConfigTree(settings);

  addGraphViewNodeStyling();
  registerCommandPaletteCommands(onloadArgs);
  createSettingsPanel(onloadArgs);
  registerSmartBlock(onloadArgs);

  setInitialQueryPages(onloadArgs, settings);

  const style = addStyle(styles);
  const discourseGraphStyle = addStyle(discourseGraphStyles);
  const settingsStyle = addStyle(settingsStyles);
  const discourseFloatingMenuStyle = addStyle(discourseFloatingMenuStyles);

  // Add streamline styling only if enabled
  const isStreamlineStylingEnabled =
    settings.personalSettings[PERSONAL_KEYS.streamlineStyling];
  let streamlineStyleElement: HTMLStyleElement | null = null;
  if (isStreamlineStylingEnabled) {
    streamlineStyleElement = addStyle(streamlineStyling);
    streamlineStyleElement.id = "streamline-styling";
  }

  const { observers, listeners, cleanups } = initObservers({
    onloadArgs,
    settings,
  });
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

  if (isSyncEnabled()) {
    initializeSupabaseSync();
  }

  const { extensionAPI } = onloadArgs;
  if (isNewSettingsStoreEnabled()) {
    const personalLegacyKeys = [
      "discourse-context-overlay",
      "text-selection-popup",
      "disable-sidebar-open",
      "page-preview",
      "hide-feedback-button",
      "auto-canvas-relations",
      "discourse-context-overlay-in-canvas",
      "streamline-styling",
      "disallow-diagnostics",
      "discourse-tool-shortcut",
      "personal-node-menu-trigger",
      "node-search-trigger",
      "hide-metadata",
      "default-page-size",
      "query-pages",
      "default-filters",
      "use-reified-relations",
      "canvas-page-format",
    ];
    void extensionAPI.ui.commandPalette.addCommand({
      label: "DG: Dev - Nuke personal legacy settings",
      callback: () => {
        const before = Object.fromEntries(
          personalLegacyKeys.map((k) => [k, extensionAPI.settings.get(k)]),
        );
        console.log("[dg] personal legacy BEFORE nuke:", before);
        void Promise.all(
          personalLegacyKeys.map((k) => extensionAPI.settings.set(k, null)),
        ).then(() => {
          const after = Object.fromEntries(
            personalLegacyKeys.map((k) => [k, extensionAPI.settings.get(k)]),
          );
          console.log("[dg] personal legacy AFTER nuke:", after);
        });
      },
    });
  }
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

  installDiscourseFloatingMenu(onloadArgs, settings);

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
        void mountLeftSidebar({ wrapper, onloadArgs });
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

  const { blockUids } = await initSchema();
  const cleanupPullWatchers = setupPullWatchOnSettingsPage(blockUids);

  console.log(
    `[DG Plugin] Total load: ${Math.round(performance.now() - pluginLoadStart)}ms`,
  );

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
