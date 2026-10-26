import type { App, TFile } from "obsidian";

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

const SETTINGS_POLL_MS = 250;

// Settings is a separate window in Obsidian 1.13 with no tab-change event, so poll the active tab.
export const doneWhenSettingsTabOpen =
  (app: App, tabId: string): WatchDone =>
  (done) => {
    const interval = window.setInterval(() => {
      if (app.setting.activeTab?.id === tabId) done();
    }, SETTINGS_POLL_MS);
    return () => window.clearInterval(interval);
  };

const nodeTypeIdOf = (app: App, file: TFile): unknown =>
  app.metadataCache.getFileCache(file)?.frontmatter?.nodeTypeId;

/** Without a node type any note counts, but only one opened during the step. */
export const doneWhenNoteOpens =
  (app: App, nodeTypeId?: string): WatchDone =>
  (done) => {
    const active = app.workspace.getActiveFile();
    if (nodeTypeId && active && nodeTypeIdOf(app, active) === nodeTypeId) {
      done();
      return () => {};
    }
    const ref = app.workspace.on("file-open", (file) => {
      if (file && (!nodeTypeId || nodeTypeIdOf(app, file) === nodeTypeId)) {
        done();
      }
    });
    return () => app.workspace.offref(ref);
  };

export const doneWhenTextSelected =
  (app: App): WatchDone =>
  (done) => {
    const check = (): void => {
      if (app.workspace.activeEditor?.editor?.somethingSelected()) done();
    };
    check();
    document.addEventListener("selectionchange", check);
    return () => document.removeEventListener("selectionchange", check);
  };

export const doneWhenBaseCreated =
  (app: App): WatchDone =>
  (done) => {
    const ref = app.vault.on("create", (file) => {
      if (file.path.endsWith(".base")) done();
    });
    return () => app.vault.offref(ref);
  };

/**
 * Completes when a note the user had open during the step gains the node type.
 * Remembering each note's type on open avoids both a vault scan and firing on edits to existing nodes.
 */
export const doneWhenNoteConverted =
  (app: App, nodeTypeId: string): WatchDone =>
  (done) => {
    const typeOnOpen = new Map<string, unknown>();
    const remember = (file: TFile | null): void => {
      if (file && !typeOnOpen.has(file.path)) {
        typeOnOpen.set(file.path, nodeTypeIdOf(app, file));
      }
    };
    remember(app.workspace.getActiveFile());
    const openRef = app.workspace.on("file-open", remember);
    const changedRef = app.metadataCache.on("changed", (file, _data, cache) => {
      if (
        typeOnOpen.has(file.path) &&
        typeOnOpen.get(file.path) !== nodeTypeId &&
        cache.frontmatter?.nodeTypeId === nodeTypeId
      ) {
        done();
      }
    });
    return () => {
      app.workspace.offref(openRef);
      app.metadataCache.offref(changedRef);
    };
  };
