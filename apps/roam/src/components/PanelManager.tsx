import React, { useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { Navbar, Alignment, Button } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types/native";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { DiscourseSuggestionsPanel } from "./DiscourseSuggestionsPanel";

const SPACING_PREFIX = "rm-spacing--";
const initialSpacingByWrapper = new WeakMap<HTMLElement, string | null>();

type PanelState = {
  blockUid: string;
  onloadArgs: OnloadArgs;
  element: HTMLElement | null;
};
type PanelEntry = [string, PanelState];

let globalIsMinimized = false;
const openPanels: Map<string, PanelState> = new Map();

const panelSubscribers = new Map<string, Set<(isOpen: boolean) => void>>();

const notifySubscribers = (tag: string, isOpen: boolean): void => {
  const subscribers = panelSubscribers.get(tag);
  if (subscribers) {
    subscribers.forEach((callback) => callback(isOpen));
  }
};

export const subscribeToPanelState = (
  tag: string,
  callback: (isOpen: boolean) => void,
): (() => void) => {
  if (!panelSubscribers.has(tag)) {
    panelSubscribers.set(tag, new Set());
  }
  panelSubscribers.get(tag)!.add(callback);

  callback(openPanels.has(tag));

  return () => {
    const subscribers = panelSubscribers.get(tag);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        panelSubscribers.delete(tag);
      }
    }
  };
};

const getSpacingClass = (element: HTMLElement): string | null => {
  for (const className of Array.from(element.classList)) {
    if (className.startsWith(SPACING_PREFIX)) return className;
  }
  return null;
};

const setSpacingClass = (
  element: HTMLElement,
  spacingClass: string | null,
): void => {
  for (const className of Array.from(element.classList)) {
    if (className.startsWith(SPACING_PREFIX))
      element.classList.remove(className);
  }
  if (spacingClass) element.classList.add(spacingClass);
};

const selectOpenPanelsEntries = (): PanelEntry[] =>
  Array.from(openPanels.entries());

const subscribeToOpenPanels = (callback: () => void): (() => void) => {
  const handler = (): void => callback();
  panelManager.addListener("change", handler);
  return () => panelManager.removeListener("change", handler);
};

const useExternalStore = <T,>(
  selector: () => T,
  subscribe: (callback: () => void) => () => void,
): T => {
  const [state, setState] = useState<T>(selector);

  useEffect(() => {
    const handleChange = (): void => setState(selector());
    const unsubscribe = subscribe(handleChange);
    handleChange();
    return unsubscribe;
  }, [selector, subscribe]);

  return state;
};

export const PanelContainer = (): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);

  const panels = useExternalStore<PanelEntry[]>(
    selectOpenPanelsEntries,
    subscribeToOpenPanels,
  );

  const [isMinimized, setIsMinimized] = useState(globalIsMinimized);

  useEffect(() => {
    const roamBodyMain = document.querySelector<HTMLElement>(".roam-body-main");
    const articleWrapper = roamBodyMain?.querySelector<HTMLElement>(
      ".rm-article-wrapper",
    );

    if (roamBodyMain && articleWrapper && containerRef.current) {
      roamBodyMain.style.display = "flex";
      roamBodyMain.dataset.isSplit = "true";
      articleWrapper.style.flex = "1 1 60%";

      if (!initialSpacingByWrapper.has(articleWrapper)) {
        initialSpacingByWrapper.set(
          articleWrapper,
          getSpacingClass(articleWrapper),
        );
      }
      setSpacingClass(articleWrapper, "rm-spacing--full");
    }

    return () => {
      if (roamBodyMain && articleWrapper) {
        roamBodyMain.removeAttribute("data-is-split");
        roamBodyMain.style.display = "";
        articleWrapper.style.flex = "";
        const initial = initialSpacingByWrapper.get(articleWrapper) ?? null;
        setSpacingClass(articleWrapper, initial);
      }
    };
  }, []);

  useEffect(() => {
    globalIsMinimized = isMinimized;
    const roamBodyMain = document.querySelector<HTMLElement>(".roam-body-main");
    const articleWrapper = roamBodyMain?.querySelector<HTMLElement>(
      ".rm-article-wrapper",
    );

    if (articleWrapper) {
      articleWrapper.style.flex = isMinimized ? "1 1 auto" : "1 1 60%";
    }
    if (containerMount) {
      containerMount.style.flex = isMinimized ? "0 0 auto" : "0 0 40%";
      containerMount.style.width = isMinimized ? "auto" : "";
    }
  }, [isMinimized]);

  const handleMinimize = useCallback(() => setIsMinimized(true), []);
  const handleRestore = useCallback(() => setIsMinimized(false), []);
  const handleCloseAll = useCallback(() => panelManager.closeAll(), []);
  const getBooleanSetting = (
    extensionAPI: unknown,
    key: string,
    defaultValue: boolean,
  ): boolean => {
    try {
      const value = (
        extensionAPI as { settings: { get: (k: string) => unknown } }
      ).settings.get(key);
      return value == null ? defaultValue : Boolean(value);
    } catch {
      return defaultValue;
    }
  };

  return (
    <div
      ref={containerRef}
      id="discourse-graph-suggestions-root"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      {!isMinimized ? (
        <div
          id="discourse-graph-panels-container"
          className="flex flex-1 flex-col gap-2 overflow-y-auto bg-transparent"
        >
          <div id="discourse-suggestions-header">
            <Navbar className="flex items-center rounded-t shadow-none">
              <Navbar.Group
                align={Alignment.LEFT}
                className="flex-grow overflow-hidden"
              >
                <Navbar.Heading className="truncate bg-transparent text-[13px] font-semibold">
                  Suggested Discourse nodes
                </Navbar.Heading>
              </Navbar.Group>
              <Navbar.Group align={Alignment.RIGHT}>
                <Button
                  icon="minus"
                  minimal
                  small
                  title="Minimize sidebar"
                  onClick={handleMinimize}
                />
                <Button
                  icon="cross"
                  minimal
                  small
                  title="Close all open panels"
                  onClick={handleCloseAll}
                />
              </Navbar.Group>
            </Navbar>
          </div>

          {panels.map(([tag, state]) => (
            <div
              key={tag}
              id={`discourse-panel-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`}
              className="m-2 flex-shrink-0 rounded bg-white shadow"
            >
              <ExtensionApiContextProvider {...state.onloadArgs}>
                <DiscourseSuggestionsPanel
                  tag={tag}
                  blockUid={state.blockUid}
                  onClose={() => panelManager.removePanel(tag)}
                  shouldGrabFromReferencedPages={getBooleanSetting(
                    state.onloadArgs.extensionAPI,
                    "context-grab-from-referenced-pages",
                    true,
                  )}
                  shouldGrabParentChildContext={getBooleanSetting(
                    state.onloadArgs.extensionAPI,
                    "context-grab-parent-child-context",
                    true,
                  )}
                />
              </ExtensionApiContextProvider>
            </div>
          ))}
        </div>
      ) : (
        <div
          id="discourse-suggestions-minimized"
          className="m-2 flex w-fit items-center gap-1 rounded bg-white px-2 py-[6px] shadow-sm"
        >
          <Button
            icon="panel-stats"
            minimal
            small
            title="Restore sidebar"
            onClick={handleRestore}
          />
        </div>
      )}
    </div>
  );
};

let navigationObserver: MutationObserver | null = null;

const cssEscape = (value: string): string =>
  window.CSS && window.CSS.escape
    ? window.CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, (c: string) => `\\${c}`);

const clearBlockHighlight = (blockUid: string): void => {
  try {
    const nodes = document.querySelectorAll(
      `[data-dg-block-uid="${blockUid}"]`,
    );
    nodes.forEach((el) => el.classList.remove("dg-highlight"));
  } catch {
    // no-op
  }
};

let articleWrapperObserver: MutationObserver | null = null;
const cleanupNavigationObserver = (): void => {
  if (navigationObserver) {
    navigationObserver.disconnect();
    navigationObserver = null;
  }
};

const cleanupArticleWrapperObserver = (): void => {
  if (articleWrapperObserver) {
    articleWrapperObserver.disconnect();
    articleWrapperObserver = null;
  }
};

const initializeNavigationObserver = (): void => {
  if (navigationObserver) {
    return;
  }

  const roamApp = document.querySelector(".roam-app");
  if (!roamApp) return;

  navigationObserver = new MutationObserver((): void => {
    if (openPanels.size > 0) {
      const isMountConnected = !!(
        containerMount && document.body.contains(containerMount)
      );
      const panelRoot = document.getElementById(
        "discourse-graph-suggestions-root",
      );
      if (!isMountConnected || !panelRoot) {
        if (containerMount && !isMountConnected) {
          containerMount = null;
        }
        mountPanelContainer();
      }
    }
  });

  navigationObserver.observe(roamApp, {
    childList: true,
    subtree: true,
  });
};

const cleanupObservers = (): void => {
  cleanupArticleWrapperObserver();
  cleanupNavigationObserver();
};

if (typeof window !== "undefined") {
  const handleUnload = (): void => {
    cleanupObservers();
    openPanels.clear();
  };

  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("pagehide", handleUnload);
}

let containerMount: HTMLElement | null = null;

export const mountPanelContainer = (): void => {
  if (containerMount && !document.body.contains(containerMount)) {
    containerMount = null;
  }

  if (containerMount) return;

  const roamBodyMain = document.querySelector<HTMLElement>(".roam-body-main");
  const articleWrapper = roamBodyMain?.querySelector<HTMLElement>(
    ".rm-article-wrapper",
  );

  if (!roamBodyMain || !articleWrapper) return;

  containerMount = document.createElement("div");
  containerMount.setAttribute("data-dg-role", "panel-container-mount");
  roamBodyMain.insertBefore(containerMount, articleWrapper);

  ReactDOM.render(<PanelContainer />, containerMount);
};

const unmountPanelContainer = (): void => {
  if (!containerMount) return;

  ReactDOM.unmountComponentAtNode(containerMount);
  containerMount.remove();
  containerMount = null;
};

type PanelManager = {
  listeners: Set<() => void>;
  addListener: (event: "change", handler: () => void) => void;
  removeListener: (event: "change", handler: () => void) => void;
  notify: () => void;
  toggle: (args: {
    tag: string;
    blockUid: string;
    onloadArgs: OnloadArgs;
  }) => void;
  addPanel: (args: {
    tag: string;
    blockUid: string;
    onloadArgs: OnloadArgs;
  }) => void;
  removePanel: (tag: string) => void;
  closeAll: () => void;
  isOpen: (tag: string) => boolean;
};

export const panelManager: PanelManager = {
  listeners: new Set<() => void>(),

  addListener(event: "change", handler: () => void): void {
    this.listeners.add(handler);
  },

  removeListener(event: "change", handler: () => void): void {
    this.listeners.delete(handler);
  },

  notify(): void {
    this.listeners.forEach((handler) => handler());
  },

  toggle: ({ tag, blockUid, onloadArgs }): void => {
    if (openPanels.has(tag)) {
      panelManager.removePanel(tag);
    } else {
      panelManager.addPanel({ tag, blockUid, onloadArgs });
    }
  },

  addPanel({ tag, blockUid, onloadArgs }): void {
    mountPanelContainer();
    openPanels.set(tag, {
      blockUid,
      onloadArgs,
      element: null,
    });
    this.notify();
    notifySubscribers(tag, true);
  },

  removePanel(tag: string): void {
    const state = openPanels.get(tag);
    if (!state) return;

    openPanels.delete(tag);
    this.notify();
    clearBlockHighlight(state.blockUid);
    notifySubscribers(tag, false);

    if (openPanels.size === 0) {
      unmountPanelContainer();
    }
  },

  closeAll(): void {
    const entries = Array.from(openPanels.entries());
    openPanels.clear();
    this.notify();

    entries.forEach(([tag, state]) => {
      clearBlockHighlight(state.blockUid);
      notifySubscribers(tag, false);
    });

    unmountPanelContainer();
  },

  isOpen: (tag: string): boolean => openPanels.has(tag),
};

if (typeof window !== "undefined") {
  initializeNavigationObserver();
}
