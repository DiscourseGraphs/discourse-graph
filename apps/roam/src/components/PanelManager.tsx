import React, { useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import { Navbar, Alignment, Button } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types/native";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { DiscourseSuggestionsPanel } from "./DiscourseSuggestionsPanel";
import {
  setupSplitView,
  teardownSplitView,
  getRoamElements,
  initializeArticleWrapperObserver,
  cleanupArticleWrapperObserver,
  getGlobalIsMinimized,
  setGlobalIsMinimized,
} from "~/utils/suggestiveModeSidebarSizing";

type PanelState = {
  blockUid: string;
  onloadArgs: OnloadArgs;
  element: HTMLElement | null;
  isOpen: boolean;
};
type PanelEntry = [string, PanelState];

let navigationObserver: MutationObserver | null = null;
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

const generatePanelId = (tag: string): string =>
  `discourse-panel-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`;

const selectOpenPanelsEntries = (): PanelEntry[] =>
  Array.from(openPanels.entries()).reverse();

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

  const [isMinimized, setIsMinimized] = useState(getGlobalIsMinimized());

  useEffect(() => {
    const { roamBodyMain, articleWrapper } = getRoamElements();

    if (roamBodyMain && articleWrapper && containerRef.current) {
      setupSplitView(roamBodyMain, articleWrapper);
    }

    return () => {
      if (roamBodyMain && articleWrapper) {
        teardownSplitView(roamBodyMain, articleWrapper);
      }
    };
  }, []);

  const handleMinimize = useCallback(() => {
    setGlobalIsMinimized(true);
    setIsMinimized(true);
  }, []);
  const handleRestore = useCallback(() => {
    setGlobalIsMinimized(false);
    setIsMinimized(false);
  }, []);
  const handleCloseAll = useCallback(() => panelManager.closeAll(), []);

  return (
    <div
      ref={containerRef}
      id="discourse-graph-suggestions-root"
      className={`flex flex-col ${isMinimized ? "" : "h-full w-full max-w-2xl flex-auto"}`}
    >
      {!isMinimized ? (
        <>
          <div id="discourse-suggestions-header" className="flex-shrink-0">
            <Navbar className="flex items-center rounded-t shadow-none">
              <Navbar.Group
                align={Alignment.LEFT}
                className="flex-grow overflow-hidden"
              >
                <Navbar.Heading className="truncate bg-transparent font-semibold">
                  Suggested discourse nodes
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

          <div
            id="discourse-graph-panels-container"
            className="flex flex-1 flex-col gap-2 overflow-y-auto bg-transparent"
          >
            {panels.map(([tag, state]) => (
              <div
                key={tag}
                id={generatePanelId(tag)}
                className="m-2 flex-shrink-0 rounded bg-white shadow"
              >
                <ExtensionApiContextProvider {...state.onloadArgs}>
                  <DiscourseSuggestionsPanel
                    tag={tag}
                    blockUid={state.blockUid}
                    isOpen={state.isOpen}
                    onClose={() => panelManager.removePanel(tag)}
                    onToggle={(isOpen) =>
                      panelManager.updatePanelState(tag, { isOpen })
                    }
                  />
                </ExtensionApiContextProvider>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div
          id="discourse-suggestions-minimized"
          className="m-2 flex w-fit items-center gap-1 rounded bg-white px-2"
        >
          <Button
            icon="panel-stats"
            minimal
            small
            title="Restore suggestive mode sidebar"
            onClick={handleRestore}
          />
        </div>
      )}
    </div>
  );
};

const clearBlockHighlight = (blockUid: string): void => {
  try {
    const nodes = document.querySelectorAll(
      `[data-dg-block-uid="${blockUid}"]`,
    );
    nodes.forEach((el) =>
      el.classList.remove("suggestive-mode-overlay-highlight-on-panel-hover"),
    );
  } catch {
    // no-op
  }
};

let containerMount: HTMLElement | null = null;

export const mountPanelContainer = (): void => {
  if (containerMount && !document.body.contains(containerMount)) {
    containerMount = null;
  }

  if (containerMount) return;

  const { roamBodyMain, articleWrapper } = getRoamElements();

  if (!roamBodyMain || !articleWrapper) return;

  containerMount = document.createElement("div");
  containerMount.setAttribute("data-dg-role", "panel-container-mount");
  containerMount.style.minWidth = "24rem";
  roamBodyMain.insertBefore(containerMount, articleWrapper);

  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(<PanelContainer />, containerMount);
};

const unmountPanelContainer = (): void => {
  if (!containerMount) return;

  // eslint-disable-next-line react/no-deprecated
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
  updatePanelState: (tag: string, updates: Partial<PanelState>) => void;
  removePanel: (tag: string) => void;
  closeAll: () => void;
  isOpen: (tag: string) => boolean;
};

export const panelManager: PanelManager = {
  listeners: new Set<() => void>(),

  addListener: (event: "change", handler: () => void): void => {
    panelManager.listeners.add(handler);
  },

  removeListener: (event: "change", handler: () => void): void => {
    panelManager.listeners.delete(handler);
  },

  notify: (): void => {
    panelManager.listeners.forEach((handler) => handler());
  },

  toggle: ({ tag, blockUid, onloadArgs }): void => {
    if (openPanels.has(tag)) {
      panelManager.removePanel(tag);
    } else {
      panelManager.addPanel({ tag, blockUid, onloadArgs });
    }
  },

  addPanel: ({ tag, blockUid, onloadArgs }): void => {
    mountPanelContainer();
    openPanels.set(tag, {
      blockUid,
      onloadArgs,
      element: null,
      isOpen: true,
    });
    panelManager.notify();
    notifySubscribers(tag, true);
  },

  updatePanelState: (tag: string, updates: Partial<PanelState>): void => {
    const state = openPanels.get(tag);
    if (!state) return;

    openPanels.set(tag, { ...state, ...updates });
    panelManager.notify();
  },

  removePanel: (tag: string): void => {
    const state = openPanels.get(tag);
    if (!state) return;

    openPanels.delete(tag);
    panelManager.notify();
    clearBlockHighlight(state.blockUid);
    notifySubscribers(tag, false);

    if (openPanels.size === 0) {
      unmountPanelContainer();
    }
  },

  closeAll: (): void => {
    const entries = Array.from(openPanels.entries());
    openPanels.clear();
    panelManager.notify();

    entries.forEach(([tag, state]) => {
      clearBlockHighlight(state.blockUid);
      notifySubscribers(tag, false);
    });

    unmountPanelContainer();
  },

  isOpen: (tag: string): boolean => openPanels.has(tag),
};

const initializeNavigationObserver = (): void => {
  if (navigationObserver) {
    return;
  }

  const roamApp = document.querySelector(".roam-main");
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

const cleanupNavigationObserver = (): void => {
  if (navigationObserver) {
    navigationObserver.disconnect();
    navigationObserver = null;
  }
};

const cleanupObservers = (): void => {
  cleanupArticleWrapperObserver();
  cleanupNavigationObserver();
};

if (typeof window !== "undefined") {
  initializeNavigationObserver();
  initializeArticleWrapperObserver();

  const handleUnload = (): void => {
    cleanupObservers();
    openPanels.clear();
  };

  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("pagehide", handleUnload);
}
