import React from "react";
import ReactDOM from "react-dom";
import { OnloadArgs } from "roamjs-components/types/native";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { DiscourseSuggestionsPanel } from "./DiscourseSuggestionsPanel";

// Constants
const PANEL_ROOT_ID = "discourse-graph-suggestions-root";
const PANELS_CONTAINER_ID = "discourse-graph-panels-container";
const ARTICLE_WRAPPER_SELECTOR = ".rm-article-wrapper";
const MINIMIZED_BAR_ID = "discourse-suggestions-minimized";

// Track open panels globally
type PanelState = {
  blockUid: string;
  element: HTMLElement;
  onloadArgs: OnloadArgs;
};
const openPanels = new Map<string, PanelState>();
let isContainerMinimized = false;
let articleWrapperObserver: MutationObserver | null = null;
let navigationObserver: MutationObserver | null = null;

// Initialize observer for article wrapper changes
const initializeObserver = (mainContent: HTMLElement) => {
  if (articleWrapperObserver) {
    return;
  }
  articleWrapperObserver = new MutationObserver(() => {
    const root = document.getElementById(PANEL_ROOT_ID);
    if (root && root.style.display !== "none" && !isContainerMinimized) {
      if (!mainContent.classList.contains("rm-spacing--full")) {
        mainContent.classList.add("rm-spacing--full");
        mainContent.classList.remove("rm-spacing--small");
      }
    }
  });
  articleWrapperObserver.observe(mainContent, {
    attributes: true,
    attributeFilter: ["class"],
  });
};

// Initialize observer for navigation changes
const initializeNavigationObserver = () => {
  if (navigationObserver) {
    return;
  }

  const roamApp = document.querySelector(".roam-app");
  if (!roamApp) return;

  navigationObserver = new MutationObserver((mutations) => {
    // Check if we still have our panel root
    const panelRoot = document.getElementById(PANEL_ROOT_ID);
    const roamBodyMain = getRoamBodyMain();

    // If we have open panels but the infrastructure is gone, recreate it
    if (openPanels.size > 0 && (!panelRoot || !panelRoot.parentElement)) {
      restorePanelInfrastructure();
    }

    // Ensure split view is maintained if panels are open
    if (openPanels.size > 0 && roamBodyMain && panelRoot) {
      const articleWrapper = getArticleWrapper(roamBodyMain);
      if (articleWrapper && roamBodyMain.dataset.isSplit !== "true") {
        setupSplitView(roamBodyMain, articleWrapper, panelRoot);
      }
    }
  });

  navigationObserver.observe(roamApp, {
    childList: true,
    subtree: true,
  });
};

// Utility functions
const getRoamBodyMain = () =>
  document.querySelector(".roam-body-main") as HTMLElement | null;

const getArticleWrapper = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(ARTICLE_WRAPPER_SELECTOR);

const setupSplitView = (
  roamBodyMain: HTMLElement,
  articleWrapper: HTMLElement,
  panelRoot: HTMLElement,
) => {
  roamBodyMain.style.display = "flex";
  roamBodyMain.dataset.isSplit = "true";

  panelRoot.style.display = "flex";
  panelRoot.style.flexDirection = "column";
  panelRoot.style.flex = "0 0 40%";

  articleWrapper.style.flex = "1 1 60%";
  articleWrapper.classList.remove("rm-spacing--small");
  articleWrapper.classList.add("rm-spacing--full");

  initializeObserver(articleWrapper);
};

const teardownSplitView = () => {
  const roamBodyMain = getRoamBodyMain();
  const articleWrapper = roamBodyMain ? getArticleWrapper(roamBodyMain) : null;

  if (roamBodyMain && articleWrapper) {
    roamBodyMain.removeAttribute("data-is-split");
    roamBodyMain.style.display = "";
    articleWrapper.style.flex = "";
    articleWrapper.classList.remove("rm-spacing--full");
    articleWrapper.classList.add("rm-spacing--small");
  }

  if (articleWrapperObserver) {
    articleWrapperObserver.disconnect();
    articleWrapperObserver = null;
  }
};

// Minimized bar helpers
const createMinimizedBar = (panelRoot: HTMLElement) => {
  let minimizedBar = document.getElementById(
    MINIMIZED_BAR_ID,
  ) as HTMLElement | null;
  if (minimizedBar) return minimizedBar;

  minimizedBar = document.createElement("div");
  minimizedBar.id = MINIMIZED_BAR_ID;
  minimizedBar.style.cssText = `
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    background: #fff;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin: 8px;
    width: fit-content;
  `;

  const restoreButton = document.createElement("button");
  restoreButton.style.cssText = `
    cursor: pointer;
    border: none;
    background: transparent;
    padding: 2px 6px;
  `;
  restoreButton.title = "Restore sidebar";
  restoreButton.onclick = () => PanelManager.toggleContainerMinimize();

  const icon = document.createElement("span");
  icon.className = "bp3-icon bp3-icon-panel-stats";
  restoreButton.appendChild(icon);

  minimizedBar.appendChild(restoreButton);
  panelRoot.appendChild(minimizedBar);

  return minimizedBar;
};

const removeMinimizedBar = () => {
  const minimizedBar = document.getElementById(MINIMIZED_BAR_ID);
  if (minimizedBar) minimizedBar.remove();
};

const createPanelInfrastructure = () => {
  const roamBodyMain = getRoamBodyMain();
  if (!roamBodyMain) return null;

  const articleWrapper = getArticleWrapper(roamBodyMain);
  if (!articleWrapper) return null;

  // Check if panel root already exists (might have been hidden)
  let panelRoot = document.getElementById(PANEL_ROOT_ID) as HTMLElement | null;

  if (panelRoot) {
    // If it exists but is hidden, show it
    if (panelRoot.style.display === "none") {
      panelRoot.style.display = "flex";
    }
    // If it's not in the right place, move it
    if (panelRoot.parentElement !== roamBodyMain) {
      roamBodyMain.insertBefore(panelRoot, articleWrapper);
    }
  } else {
    // Create panel root
    panelRoot = document.createElement("div");
    panelRoot.id = PANEL_ROOT_ID;
    roamBodyMain.insertBefore(panelRoot, articleWrapper);
  }

  // Check if panels container exists
  let panelsContainer = document.getElementById(
    PANELS_CONTAINER_ID,
  ) as HTMLElement | null;

  if (!panelsContainer) {
    // Create panels container
    panelsContainer = document.createElement("div");
    panelsContainer.id = PANELS_CONTAINER_ID;
    panelsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      gap: 8px;
      padding: 8px;
      background-color: #f5f5f5;
      overflow-y: auto;
    `;

    // Create header
    const header = document.createElement("div");
    header.id = "discourse-suggestions-header";
    header.style.cssText = `
      flex: 0 0 auto;
      padding: 6px 8px;
      background-color: #fff;
      border-radius: 4px 4px 0 0;
      margin-bottom: 0;
      font-weight: 600;
      font-size: 13px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;

    const headerTitle = document.createElement("span");
    headerTitle.textContent = "Suggested Discourse nodes";

    const headerButtons = document.createElement("div");
    headerButtons.style.cssText = `
      display: flex;
      gap: 4px;
      align-items: center;
    `;

    const minimizeButton = document.createElement("button");
    minimizeButton.innerHTML = "⎯";
    minimizeButton.style.cssText = `
      cursor: pointer;
      border: none;
      background: transparent;
      padding: 2px 6px;
      font-size: 16px;
    `;
    minimizeButton.title = "Minimize sidebar";
    minimizeButton.onclick = () => PanelManager.toggleContainerMinimize();

    const closeButton = document.createElement("button");
    closeButton.textContent = "✕";
    closeButton.style.cssText = `
      cursor: pointer;
      border: none;
      background: transparent;
      padding: 2px 6px;
    `;
    closeButton.title = "Close all open panels";
    closeButton.onclick = () => PanelManager.closeAll();

    header.appendChild(headerTitle);
    headerButtons.appendChild(minimizeButton);
    headerButtons.appendChild(closeButton);
    header.appendChild(headerButtons);
    panelsContainer.appendChild(header);

    panelRoot.appendChild(panelsContainer);
  }

  // Apply split view
  setupSplitView(roamBodyMain, articleWrapper, panelRoot);

  // Initialize navigation observer
  initializeNavigationObserver();

  return panelsContainer;
};

const restorePanelInfrastructure = () => {
  // Don't restore if no panels are open
  if (openPanels.size === 0) return;

  const panelsContainer = createPanelInfrastructure();
  if (!panelsContainer) return;

  // Recreate all open panels
  const panelsToRestore = Array.from(openPanels.entries());
  openPanels.clear();

  panelsToRestore.forEach(([tag, state]) => {
    // Create new panel element
    const panelElement = document.createElement("div");
    panelElement.id = `discourse-panel-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`;
    panelElement.style.cssText = `
      flex: 0 0 auto;
      margin-bottom: 8px;
      background-color: #fff;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    // Insert after header
    const header = panelsContainer.querySelector(
      "#discourse-suggestions-header",
    );
    if (header && header.nextSibling) {
      panelsContainer.insertBefore(panelElement, header.nextSibling);
    } else {
      panelsContainer.appendChild(panelElement);
    }

    // Update state with new element
    openPanels.set(tag, { ...state, element: panelElement });

    // Render React component
    ReactDOM.render(
      <ExtensionApiContextProvider {...state.onloadArgs}>
        <DiscourseSuggestionsPanel
          tag={tag}
          blockUid={state.blockUid}
          onClose={() => PanelManager.removePanel(tag)}
        />
      </ExtensionApiContextProvider>,
      panelElement,
    );
  });

  // Restore minimized state if needed
  if (isContainerMinimized) {
    PanelManager.toggleContainerMinimize();
  }
};

const cleanupPanelInfrastructure = () => {
  // Unmount all React components
  openPanels.forEach(({ element }) => {
    ReactDOM.unmountComponentAtNode(element);
  });
  openPanels.clear();

  // Remove DOM elements (but keep them in DOM if hidden for potential restoration)
  const panelRoot = document.getElementById(PANEL_ROOT_ID);
  if (panelRoot) {
    panelRoot.remove();
  }

  // Restore layout
  teardownSplitView();

  // Disconnect observers
  if (navigationObserver) {
    navigationObserver.disconnect();
    navigationObserver = null;
  }
};

// Main Panel Manager
export const PanelManager = {
  toggle: (
    tag: string,
    blockUid: string,
    parentEl: HTMLElement,
    onloadArgs: OnloadArgs,
  ) => {
    // If this panel is already open, close it
    if (openPanels.has(tag)) {
      PanelManager.removePanel(tag);
      return;
    }

    // Add the panel
    PanelManager.addPanel(tag, blockUid, parentEl, onloadArgs);
  },

  addPanel: (
    tag: string,
    blockUid: string,
    parentEl: HTMLElement,
    onloadArgs: OnloadArgs,
  ) => {
    // Get or create infrastructure
    let panelsContainer = document.getElementById(PANELS_CONTAINER_ID);
    if (!panelsContainer) {
      panelsContainer = createPanelInfrastructure();
      if (!panelsContainer) return; // Failed to create
    }

    // Create panel element
    const panelElement = document.createElement("div");
    panelElement.id = `discourse-panel-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`;
    panelElement.style.cssText = `
      flex: 0 0 auto;
      margin-bottom: 8px;
      background-color: #fff;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `;

    // Insert after header (new panels on top)
    const header = panelsContainer.querySelector(
      "#discourse-suggestions-header",
    );
    if (header && header.nextSibling) {
      panelsContainer.insertBefore(panelElement, header.nextSibling);
    } else {
      panelsContainer.appendChild(panelElement);
    }

    // Track this panel with onloadArgs for restoration
    openPanels.set(tag, { blockUid, element: panelElement, onloadArgs });

    // Render React component
    ReactDOM.render(
      <ExtensionApiContextProvider {...onloadArgs}>
        <DiscourseSuggestionsPanel
          tag={tag}
          blockUid={blockUid}
          onClose={() => PanelManager.removePanel(tag)}
        />
      </ExtensionApiContextProvider>,
      panelElement,
    );

    // Notify listeners about panel state change
    PanelManager.notifyStateChange();
  },

  removePanel: (tag: string) => {
    const panelInfo = openPanels.get(tag);
    if (!panelInfo) return;

    // Unmount React and remove element
    ReactDOM.unmountComponentAtNode(panelInfo.element);
    panelInfo.element.remove();
    openPanels.delete(tag);

    // If no panels left, cleanup everything
    if (openPanels.size === 0) {
      cleanupPanelInfrastructure();
    }

    // Notify listeners about panel state change
    PanelManager.notifyStateChange();
  },

  closeAll: () => {
    isContainerMinimized = false;
    cleanupPanelInfrastructure();
    PanelManager.notifyStateChange();
  },

  toggleContainerMinimize: () => {
    const panelsContainer = document.getElementById(PANELS_CONTAINER_ID);
    const panelRoot = document.getElementById(PANEL_ROOT_ID);

    if (!panelsContainer || !panelRoot) return;

    isContainerMinimized = !isContainerMinimized;

    if (isContainerMinimized) {
      // Hide the full container and show a compact minimized bar
      (panelsContainer as HTMLElement).style.display = "none";

      // Shrink the panel root width and add minimized bar
      panelRoot.style.flex = "0 0 auto";
      panelRoot.style.width = "auto";
      createMinimizedBar(panelRoot as HTMLElement);

      // Adjust main content
      const roamBodyMain = getRoamBodyMain();
      const articleWrapper = roamBodyMain
        ? getArticleWrapper(roamBodyMain)
        : null;
      if (articleWrapper) {
        articleWrapper.style.flex = "1 1 auto";
      }
    } else {
      // Restore full container
      (panelsContainer as HTMLElement).style.display = "";

      // Remove minimized bar
      removeMinimizedBar();

      // Restore panel root width
      panelRoot.style.flex = "0 0 40%";
      panelRoot.style.width = "";

      // Update minimize button, if present
      const minimizeBtn = panelsContainer.querySelector<HTMLButtonElement>(
        'button[title="Restore sidebar"], button[title="Minimize sidebar"]',
      );
      if (minimizeBtn) {
        minimizeBtn.innerHTML = "⎯";
        minimizeBtn.title = "Minimize sidebar";
      }

      // Restore split view
      const roamBodyMain = getRoamBodyMain();
      const articleWrapper = roamBodyMain
        ? getArticleWrapper(roamBodyMain)
        : null;
      if (articleWrapper) {
        articleWrapper.style.flex = "1 1 60%";
      }
    }

    PanelManager.notifyStateChange();
  },

  isOpen: (tag: string) => {
    return openPanels.has(tag);
  },

  isContainerMinimized: () => {
    return isContainerMinimized;
  },

  // Simple event system for state changes
  listeners: new Set<
    (openTags: string[], containerMinimized: boolean) => void
  >(),

  subscribe: (
    callback: (openTags: string[], containerMinimized: boolean) => void,
  ) => {
    PanelManager.listeners.add(callback);
    return () => PanelManager.listeners.delete(callback);
  },

  notifyStateChange: () => {
    const openTags = Array.from(openPanels.keys());
    PanelManager.listeners.forEach((callback) =>
      callback(openTags, isContainerMinimized),
    );
  },
};
