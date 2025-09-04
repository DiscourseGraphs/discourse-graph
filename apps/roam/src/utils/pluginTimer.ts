/**
 * Global timer utility for the Discourse Graph plugin
 * Tracks when 3 seconds have passed since plugin initialization
 * This helps prevent race conditions when rendering tldraw components
 */

let pluginStartTime: number | null = null;
let isTimerReady = false;

/**
 * Initialize the plugin timer
 * Should be called when the plugin first loads
 */
export const initPluginTimer = (): void => {
  pluginStartTime = Date.now();

  // Set a timeout to mark the timer as ready after 3 seconds
  setTimeout(() => {
    isTimerReady = true;
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
  const time = Date.now() - pluginStartTime;
  return time;
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
        resolve(false);
        return;
      }
    }, 100);
  });
};
