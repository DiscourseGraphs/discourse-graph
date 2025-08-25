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
    "window.roamalphaapi:",
    typeof (window as any).roamalphaapi !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );

  // Roam Extensions
  console.log(
    "window.roamjs.extensions.querybuilder:",
    typeof (window as any).roamjs?.extensions?.querybuilder !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );

  // React and ReactDOM
  console.log(
    "window.React:",
    typeof (window as any).React !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.ReactDOM:",
    typeof (window as any).ReactDOM !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.React.useSyncExternalStore:",
    typeof (window as any).React?.useSyncExternalStore !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );

  // Blueprint UI Components
  console.log(
    "window.Blueprint.Core:",
    typeof (window as any).Blueprint?.Core !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.Blueprint.DateTime:",
    typeof (window as any).Blueprint?.DateTime !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.Blueprint.Select:",
    typeof (window as any).Blueprint?.Select !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );

  // Utility Libraries
  console.log(
    "window.ChronoNode:",
    typeof (window as any).ChronoNode !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.CryptoJS:",
    typeof (window as any).CryptoJS !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.Nanoid:",
    typeof (window as any).Nanoid !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.TSLib:",
    typeof (window as any).TSLib !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );

  // File and Data Handling
  console.log(
    "window.FileSaver:",
    typeof (window as any).FileSaver !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.idb:",
    typeof (window as any).idb !== "undefined" ? "✅ Available" : "❌ Missing",
  );

  // RoamLazy Components (loaded on demand)
  console.log(
    "window.RoamLazy.Cytoscape:",
    typeof (window as any).RoamLazy?.Cytoscape !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.RoamLazy.JSZip:",
    typeof (window as any).RoamLazy?.JSZip !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.RoamLazy.Insect:",
    typeof (window as any).RoamLazy?.Insect !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.RoamLazy.Marked:",
    typeof (window as any).RoamLazy?.Marked !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.RoamLazy.MarkedReact:",
    typeof (window as any).RoamLazy?.MarkedReact !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );

  // Additional React-related
  console.log(
    "window.ReactYoutube:",
    typeof (window as any).ReactYoutube !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );

  // DOM and Browser APIs (for tldraw)
  console.log(
    "window.requestAnimationFrame:",
    typeof window.requestAnimationFrame !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.cancelAnimationFrame:",
    typeof window.cancelAnimationFrame !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.ResizeObserver:",
    typeof window.ResizeObserver !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
  );
  console.log(
    "window.IntersectionObserver:",
    typeof window.IntersectionObserver !== "undefined"
      ? "✅ Available"
      : "❌ Missing",
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
