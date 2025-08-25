/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Global timer utility for the Discourse Graph plugin
 * Tracks when 3 seconds have passed since plugin initialization
 * This helps prevent race conditions when rendering tldraw components
 */

let pluginStartTime: number | null = null;
let isTimerReady = false;

/**
 * Log the availability of all window objects that Roam Research provides
 * This helps debug dependency availability for tldraw and other components
 */
const logWindowDependencies = (): void => {
  console.group("🔍 Roam Research Window Dependencies Check");

  const dependencies = [
    // Core Roam API
    "window.roamAlphaAPI",
    "window.roamjs.extension.querybuilder",

    // React and ReactDOM
    "window.React",
    "window.ReactDOM",
    "window.React.useSyncExternalStore",

    // Blueprint UI Components
    "window.Blueprint.Core",
    "window.Blueprint.DateTime",
    "window.Blueprint.Select",

    // Utility Libraries
    "window.ChronoNode",
    "window.CryptoJS",
    "window.Nanoid",
    "window.TSLib",

    // File and Data Handling
    "window.FileSaver",
    "window.idb",

    // RoamLazy Components (loaded on demand)
    "window.RoamLazy.Cytoscape",
    "window.RoamLazy.JSZip",
    "window.RoamLazy.Insect",
    "window.RoamLazy.Marked",
    "window.RoamLazy.MarkedReact",

    // Additional React-related
    "window.ReactYoutube",

    // DOM and Browser APIs (for tldraw)
    "window.requestAnimationFrame",
    "window.cancelAnimationFrame",
    "window.ResizeObserver",
    "window.IntersectionObserver",
  ];

  dependencies.forEach((dependency) => {
    const path = dependency.replace("window.", "").split(".");
    let value: any = window;

    for (const key of path) {
      value = value?.[key];
    }

    const isAvailable = typeof value !== "undefined";
    console.log(`${isAvailable ? "✅" : "❌"} ${dependency}`);
  });

  console.groupEnd();
};

/**
 * Initialize the plugin timer
 * Should be called when the plugin first loads
 */
export const initPluginTimer = (): void => {
  pluginStartTime = Date.now();
  console.log("Discourse Graph plugin timer initialized");

  // Log initial dependency check
  logWindowDependencies();

  // Set a timeout to mark the timer as ready after 3 seconds
  setTimeout(() => {
    isTimerReady = true;
    console.log("Discourse Graph plugin timer ready (3 seconds elapsed)");

    // Log final dependency check
    logWindowDependencies();
  }, 3000);
};

/**
 * Check if the plugin timer is ready (3 seconds have passed)
 * @returns true if 3 seconds have passed since plugin initialization
 */
export const isPluginTimerReady = (): boolean => {
  if (pluginStartTime === null) {
    console.warn("Plugin timer not initialized");
    return false;
  }

  // Log dependencies every time timer is checked
  logWindowDependencies();

  return isTimerReady;
};

/**
 * Get the elapsed time since plugin initialization
 * @returns elapsed time in milliseconds, or 0 if not initialized
 */
export const getPluginElapsedTime = (): number => {
  if (pluginStartTime === null) {
    return 0;
  }

  return Date.now() - pluginStartTime;
};

/**
 * Wait for the plugin timer to be ready
 * @param timeoutMs maximum time to wait (default: 5000ms)
 * @returns Promise that resolves when timer is ready or timeout is reached
 */
export const waitForPluginTimer = (
  timeoutMs: number = 5000,
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isPluginTimerReady()) {
      resolve(true);
      return;
    }

    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isPluginTimerReady()) {
        clearInterval(checkInterval);
        resolve(true);
        return;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        clearInterval(checkInterval);
        console.warn("Plugin timer wait timeout reached");
        resolve(false);
        return;
      }
    }, 100);
  });
};
