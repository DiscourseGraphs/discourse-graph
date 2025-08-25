import { OnloadArgs } from "roamjs-components/types";
import { DEFAULT_CANVAS_PAGE_FORMAT } from "..";
import { getFormattedConfigTree } from "./discourseConfigRef";

export const isCanvasPage = ({ title }: { title: string }) => {
  const { canvasPageFormat } = getFormattedConfigTree();
  const format = canvasPageFormat.value || DEFAULT_CANVAS_PAGE_FORMAT;
  const canvasRegex = new RegExp(`^${format}$`.replace(/\*/g, ".+"));
  return canvasRegex.test(title);
};

export const isCurrentPageCanvas = ({
  title,
  h1,
}: {
  title: string;
  h1: HTMLHeadingElement;
}) => {
  return isCanvasPage({ title }) && !!h1.closest(".roam-article");
};

export const isSidebarCanvas = ({
  title,
  h1,
}: {
  title: string;
  h1: HTMLHeadingElement;
}) => {
  return isCanvasPage({ title }) && !!h1.closest(".rm-sidebar-outline");
};

/**
 * Checks if Roam Research and the plugin are properly loaded
 * This helps prevent race conditions when directly loading Canvas/* pages
 */
export const isRoamAndPluginLoaded = (onloadArgs: OnloadArgs): boolean => {
  // Check if Roam's core API is available
  if (!window.roamAlphaAPI) {
    return false;
  }

  // Check if Roam's UI is ready (main window exists)
  if (!window.roamAlphaAPI.ui?.mainWindow) {
    return false;
  }

  // Check if the plugin's extension API is available
  if (!onloadArgs) {
    return false;
  }

  // Check if Roam's DOM is ready (article container exists)
  if (!document.querySelector(".roam-article")) {
    return false;
  }

  // Check if tldraw is available (prevent .next errors)
  if (typeof window !== "undefined" && !window.tldrawApps) {
    window.tldrawApps = {};
  }

  return true;
};

/**
 * Waits for Roam and plugin to be loaded with a timeout
 * Returns true if loaded, false if timeout reached
 */
export const waitForRoamAndPluginLoaded = (
  timeoutMs: number = 5000,
  onloadArgs: OnloadArgs,
): Promise<boolean> => {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const check = () => {
      if (isRoamAndPluginLoaded(onloadArgs)) {
        resolve(true);
        return;
      }

      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        console.warn("Timeout waiting for Roam and plugin to load");
        resolve(false);
        return;
      }

      // Check again in 100ms
      setTimeout(check, 100);
    };

    check();
  });
};

/**
 * Safely renders canvas components with retry logic
 * This handles race conditions when directly loading Canvas/* pages
 */
type SafeRenderOptions = {
  renderFunction: () => void;
  maxRetries?: number;
  retryDelay?: number;
  onloadArgs: OnloadArgs;
};

export const safeRenderCanvas = async ({
  renderFunction,
  maxRetries = 3,
  retryDelay = 1000,
  onloadArgs,
}: SafeRenderOptions): Promise<void> => {
  let attempts = 0;

  const attemptRender = async (): Promise<void> => {
    attempts++;

    try {
      // Wait for Roam and plugin to be loaded
      const isLoaded = await waitForRoamAndPluginLoaded(retryDelay, onloadArgs);

      if (isLoaded) {
        renderFunction();
        return;
      }

      // If not loaded and we have retries left, try again
      if (attempts < maxRetries) {
        console.log(
          `Canvas render attempt ${attempts} failed, retrying in ${retryDelay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return attemptRender();
      }

      // Max retries reached
      console.warn(`Failed to render canvas after ${maxRetries} attempts`);
    } catch (error) {
      console.error("Error during canvas render attempt:", error);

      // If we have retries left, try again
      if (attempts < maxRetries) {
        console.log(
          `Canvas render attempt ${attempts} errored, retrying in ${retryDelay}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        return attemptRender();
      }

      // Max retries reached
      console.error(
        `Failed to render canvas after ${maxRetries} attempts due to errors`,
      );
    }
  };

  await attemptRender();
};
