import type { App } from "obsidian";

export type Placement = "top" | "bottom" | "left" | "right";

/** Calls `done` once the user has completed the step; returns a cleanup. */
export type WatchDone = (done: () => void) => () => void;

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** CSS selector to spotlight. Without one the step shows as a floating card. */
  target?: string;
  placement?: Placement;
  /** Without one the step advances only through the Next button. */
  watchDone?: WatchDone;
  /** Obsidian basics that users who already know Obsidian can skip. */
  basics?: boolean;
};

// Delegated from the document so the step still completes if Obsidian re-renders the target.
export const doneOnClick =
  (selector: string): WatchDone =>
  (done) => {
    const handleClick = (event: MouseEvent): void => {
      if (event.target instanceof Element && event.target.closest(selector)) {
        done();
      }
    };
    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  };

export const doneWhenPresent =
  (selector: string): WatchDone =>
  (done) => {
    if (document.querySelector(selector)) {
      done();
      return () => {};
    }
    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) return;
      observer.disconnect();
      done();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  };

// Every run path (palette, hotkey, slash menu, executeCommandById) ends in the command object's own callback.
export const doneWhenCommandRuns =
  (app: App, commandId: string): WatchDone =>
  (done) => {
    const command = app.commands.findCommand(commandId);
    if (!command) return () => {};
    const { callback, checkCallback } = command;
    if (checkCallback) {
      command.checkCallback = (checking) => {
        const result = checkCallback.call(command, checking);
        if (!checking && result !== false) done();
        return result;
      };
    } else if (callback) {
      command.callback = () => {
        callback.call(command);
        done();
      };
    }
    return () => {
      command.callback = callback;
      command.checkCallback = checkCallback;
    };
  };

/** Completes when a file created during the step gets the given node type in its frontmatter. */
export const doneWhenNodeCreated =
  (app: App, nodeTypeId: string): WatchDone =>
  (done) => {
    const createdPaths = new Set<string>();
    const createRef = app.vault.on("create", (file) => {
      createdPaths.add(file.path);
    });
    const changedRef = app.metadataCache.on("changed", (file, _data, cache) => {
      if (
        createdPaths.has(file.path) &&
        cache.frontmatter?.nodeTypeId === nodeTypeId
      ) {
        done();
      }
    });
    return () => {
      app.vault.offref(createRef);
      app.metadataCache.offref(changedRef);
    };
  };

export const doneWhenViewOpen =
  (app: App, viewType: string): WatchDone =>
  (done) => {
    const check = (): void => {
      if (app.workspace.getLeavesOfType(viewType).length > 0) done();
    };
    check();
    const ref = app.workspace.on("layout-change", check);
    return () => app.workspace.offref(ref);
  };
