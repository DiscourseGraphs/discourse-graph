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

  // Core Roam API
  console.log(
    `${typeof (window as any).roamAlphaAPI !== "undefined" ? "✅" : "❌"} window.roamalphaapi`,
  );

  // Roam Extensions
  console.log(
    `${typeof (window as any).roamjs?.extensions?.querybuilder !== "undefined" ? "✅" : "❌"} window.roamjs.extensions.querybuilder`,
  );

  // React and ReactDOM
  console.log(
    `${typeof (window as any).React !== "undefined" ? "✅" : "❌"} window.React`,
  );
  console.log(
    `${typeof (window as any).ReactDOM !== "undefined" ? "✅" : "❌"} window.ReactDOM`,
  );
  console.log(
    `${typeof (window as any).React?.useSyncExternalStore !== "undefined" ? "✅" : "❌"} window.React.useSyncExternalStore`,
  );

  // Blueprint UI Components
  console.log(
    `${typeof (window as any).Blueprint?.Core !== "undefined" ? "✅" : "❌"} window.Blueprint.Core`,
  );
  console.log(
    `${typeof (window as any).Blueprint?.DateTime !== "undefined" ? "✅" : "❌"} window.Blueprint.DateTime`,
  );
  console.log(
    `${typeof (window as any).Blueprint?.Select !== "undefined" ? "✅" : "❌"} window.Blueprint.Select`,
  );

  // Utility Libraries
  console.log(
    `${typeof (window as any).ChronoNode !== "undefined" ? "✅" : "❌"} window.ChronoNode`,
  );
  console.log(
    `${typeof (window as any).CryptoJS !== "undefined" ? "✅" : "❌"} window.CryptoJS`,
  );
  console.log(
    `${typeof (window as any).Nanoid !== "undefined" ? "✅" : "❌"} window.Nanoid`,
  );
  console.log(
    `${typeof (window as any).TSLib !== "undefined" ? "✅" : "❌"} window.TSLib`,
  );

  // File and Data Handling
  console.log(
    `${typeof (window as any).FileSaver !== "undefined" ? "✅" : "❌"} window.FileSaver`,
  );
  console.log(
    `${typeof (window as any).idb !== "undefined" ? "✅" : "❌"} window.idb`,
  );

  // RoamLazy Components (loaded on demand)
  console.log(
    `${typeof (window as any).RoamLazy?.Cytoscape !== "undefined" ? "✅" : "❌"} window.RoamLazy.Cytoscape`,
  );
  console.log(
    `${typeof (window as any).RoamLazy?.JSZip !== "undefined" ? "✅" : "❌"} window.RoamLazy.JSZip`,
  );
  console.log(
    `${typeof (window as any).RoamLazy?.Insect !== "undefined" ? "✅" : "❌"} window.RoamLazy.Insect`,
  );
  console.log(
    `${typeof (window as any).RoamLazy?.Marked !== "undefined" ? "✅" : "❌"} window.RoamLazy.Marked`,
  );
  console.log(
    `${typeof (window as any).RoamLazy?.MarkedReact !== "undefined" ? "✅" : "❌"} window.RoamLazy.MarkedReact`,
  );

  // Additional React-related
  console.log(
    `${typeof (window as any).ReactYoutube !== "undefined" ? "✅" : "❌"} window.ReactYoutube`,
  );

  // DOM and Browser APIs (for tldraw)
  console.log(
    `${typeof window.requestAnimationFrame !== "undefined" ? "✅" : "❌"} window.requestAnimationFrame`,
  );
  console.log(
    `${typeof window.cancelAnimationFrame !== "undefined" ? "✅" : "❌"} window.cancelAnimationFrame`,
  );
  console.log(
    `${typeof window.ResizeObserver !== "undefined" ? "✅" : "❌"} window.ResizeObserver`,
  );
  console.log(
    `${typeof window.IntersectionObserver !== "undefined" ? "✅" : "❌"} window.IntersectionObserver`,
  );

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
