import React from "react";
import ReactDOM from "react-dom";
import { Navbar, Alignment, Button } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types/native";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { DiscourseSuggestionsPanel } from "./DiscourseSuggestionsPanel";

const PANEL_ROOT_ID = "discourse-graph-suggestions-root";
const PANELS_CONTAINER_ID = "discourse-graph-panels-container";
const ARTICLE_WRAPPER_SELECTOR = ".rm-article-wrapper";
const MINIMIZED_BAR_ID = "discourse-suggestions-minimized";
const SPACING_PREFIX = "rm-spacing--";
const initialSpacingByWrapper = new WeakMap<HTMLElement, string | null>();

const STYLES = {
  minimizedBar: `
    display: flex; align-items: center; gap: 4px; padding: 6px 8px;
    background: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    margin: 8px; width: fit-content;
  `,
  panelsContainer: `
    display: flex; flex-direction: column; flex: 1 1 auto; gap: 8px;
    padding: 8px; background-color: #f5f5f5; overflow-y: auto;
  `,
  header: `
    flex: 0 0 auto; padding: 6px 8px; background-color: #fff;
    border-radius: 4px 4px 0 0; margin-bottom: 0; font-weight: 600;
    font-size: 13px; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    display: flex; justify-content: space-between; align-items: center;
  `,
  headerButtons: `display: flex; gap: 4px; align-items: center;`,
  button: `cursor: pointer; border: none; background: transparent; padding: 2px 6px;`,
  minimizeButton: `cursor: pointer; border: none; background: transparent; padding: 2px 6px; font-size: 16px;`,
  panelElement: `
    flex: 0 0 auto; margin-bottom: 8px; background-color: #fff;
    border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  `,
} as const;

type PanelState = {
  blockUid: string;
  element: HTMLElement;
  onloadArgs: OnloadArgs;
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

const SidebarHeader = ({
  onMinimize,
  onCloseAll,
}: {
  onMinimize: () => void;
  onCloseAll: () => void;
}) => (
  <Navbar style={{ boxShadow: "none", borderRadius: "4px 4px 0 0" }}>
    <Navbar.Group align={Alignment.LEFT}>
      <Navbar.Heading style={{ fontWeight: 600, fontSize: 13 }}>
        Suggested Discourse nodes
      </Navbar.Heading>
    </Navbar.Group>
    <Navbar.Group align={Alignment.RIGHT}>
      <Button
        icon="minus"
        minimal
        small
        title="Minimize sidebar"
        onClick={onMinimize}
      />
      <Button
        icon="cross"
        minimal
        small
        title="Close all open panels"
        onClick={onCloseAll}
      />
    </Navbar.Group>
  </Navbar>
);

const openPanels = new Map<string, PanelState>();
let isContainerMinimized = false;

const getRoamBodyMain = () =>
  document.querySelector<HTMLElement>(".roam-body-main");
const getArticleWrapper = (container: HTMLElement) =>
  container.querySelector<HTMLElement>(ARTICLE_WRAPPER_SELECTOR);

const setupSplitView = ({
  roamBodyMain,
  articleWrapper,
  panelRoot,
}: {
  roamBodyMain: HTMLElement;
  articleWrapper: HTMLElement;
  panelRoot: HTMLElement;
}): void => {
  roamBodyMain.style.display = "flex";
  roamBodyMain.dataset.isSplit = "true";

  panelRoot.style.display = "flex";
  panelRoot.style.flexDirection = "column";
  panelRoot.style.flex = "0 0 40%";

  articleWrapper.style.flex = "1 1 60%";
  if (!initialSpacingByWrapper.has(articleWrapper)) {
    initialSpacingByWrapper.set(
      articleWrapper,
      getSpacingClass(articleWrapper),
    );
  }
  setSpacingClass(articleWrapper, "rm-spacing--full");

  initializeArticleWrapperObserver({ mainContent: articleWrapper });
};

const teardownSplitView = (): void => {
  const roamBodyMain = getRoamBodyMain();
  const articleWrapper = roamBodyMain ? getArticleWrapper(roamBodyMain) : null;

  if (roamBodyMain && articleWrapper) {
    roamBodyMain.removeAttribute("data-is-split");
    roamBodyMain.style.display = "";
    articleWrapper.style.flex = "";
    const initial = initialSpacingByWrapper.get(articleWrapper) ?? null;
    setSpacingClass(articleWrapper, initial);
  }

  cleanupArticleWrapperObserver();
};

let articleWrapperObserver: MutationObserver | null = null;

const initializeArticleWrapperObserver = ({
  mainContent,
}: {
  mainContent: HTMLElement;
}): void => {
  if (articleWrapperObserver) return;

  articleWrapperObserver = new MutationObserver(() => {
    const root = document.getElementById(PANEL_ROOT_ID);
    if (root && root.style.display !== "none" && !isContainerMinimized) {
      if (getSpacingClass(mainContent) !== "rm-spacing--full") {
        setSpacingClass(mainContent, "rm-spacing--full");
      }
    }
  });

  articleWrapperObserver.observe(mainContent, {
    attributes: true,
    attributeFilter: ["class"],
  });
};

const cleanupArticleWrapperObserver = () => {
  if (articleWrapperObserver) {
    articleWrapperObserver.disconnect();
    articleWrapperObserver = null;
  }
};

const cleanupObservers = (): void => {
  cleanupArticleWrapperObserver();
};

if (typeof window !== "undefined") {
  const handleUnload = () => {
    cleanupObservers();
    openPanels.clear();
  };

  window.addEventListener("beforeunload", handleUnload);
  window.addEventListener("pagehide", handleUnload);
}

const createMinimizedBar = (panelRoot: HTMLElement) => {
  let minimizedBar = document.getElementById(MINIMIZED_BAR_ID);
  if (minimizedBar) return minimizedBar;

  minimizedBar = document.createElement("div");
  minimizedBar.id = MINIMIZED_BAR_ID;
  minimizedBar.style.cssText = STYLES.minimizedBar;
  panelRoot.appendChild(minimizedBar);

  ReactDOM.render(
    <Button
      icon="panel-stats"
      minimal
      small
      title="Restore sidebar"
      onClick={() => panelManager.toggleContainerMinimize()}
    />,
    minimizedBar,
  );

  return minimizedBar;
};

const removeMinimizedBar = () => {
  const minimizedBar = document.getElementById(MINIMIZED_BAR_ID);
  if (minimizedBar) {
    ReactDOM.unmountComponentAtNode(minimizedBar);
    minimizedBar.remove();
  }
};

const createPanelInfrastructure = () => {
  const roamBodyMain = getRoamBodyMain();
  if (!roamBodyMain) return null;

  const articleWrapper = getArticleWrapper(roamBodyMain);
  if (!articleWrapper) return null;

  let panelRoot = document.getElementById(PANEL_ROOT_ID);
  if (panelRoot) {
    if (panelRoot.style.display === "none") panelRoot.style.display = "flex";
    if (panelRoot.parentElement !== roamBodyMain) {
      roamBodyMain.insertBefore(panelRoot, articleWrapper);
    }
  } else {
    panelRoot = document.createElement("div");
    panelRoot.id = PANEL_ROOT_ID;
    roamBodyMain.insertBefore(panelRoot, articleWrapper);
  }

  let panelsContainer = document.getElementById(PANELS_CONTAINER_ID);
  if (!panelsContainer) {
    panelsContainer = document.createElement("div");
    panelsContainer.id = PANELS_CONTAINER_ID;
    panelsContainer.style.cssText = STYLES.panelsContainer;

    const header = document.createElement("div");
    header.id = "discourse-suggestions-header";
    panelsContainer.appendChild(header);
    ReactDOM.render(
      <SidebarHeader
        onMinimize={() => panelManager.toggleContainerMinimize()}
        onCloseAll={() => panelManager.closeAll()}
      />,
      header,
    );
    panelRoot.appendChild(panelsContainer);
  }

  setupSplitView({ roamBodyMain, articleWrapper, panelRoot });
  return panelsContainer;
};

const restorePanelInfrastructure = () => {
  if (openPanels.size === 0) return;

  const panelsContainer = createPanelInfrastructure();
  if (!panelsContainer) return;

  const panelsToRestore = Array.from(openPanels.entries());
  openPanels.clear();

  panelsToRestore.forEach(([tag, state]) => {
    const panelElement = document.createElement("div");
    panelElement.id = `discourse-panel-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`;
    panelElement.style.cssText = STYLES.panelElement;

    const header = panelsContainer.querySelector(
      "#discourse-suggestions-header",
    );
    if (header && header.nextSibling) {
      panelsContainer.insertBefore(panelElement, header.nextSibling);
    } else {
      panelsContainer.appendChild(panelElement);
    }

    openPanels.set(tag, { ...state, element: panelElement });

    ReactDOM.render(
      <ExtensionApiContextProvider {...state.onloadArgs}>
        <DiscourseSuggestionsPanel
          tag={tag}
          blockUid={state.blockUid}
          onClose={() => panelManager.removePanel(tag)}
        />
      </ExtensionApiContextProvider>,
      panelElement,
    );
  });

  if (isContainerMinimized) {
    panelManager.toggleContainerMinimize();
  }
};

const cleanupPanelInfrastructure = () => {
  openPanels.forEach(({ element }) => {
    ReactDOM.unmountComponentAtNode(element);
  });
  openPanels.clear();

  const panelRoot = document.getElementById(PANEL_ROOT_ID);
  if (panelRoot) {
    const header = panelRoot.querySelector(
      "#discourse-suggestions-header",
    ) as HTMLElement | null;
    if (header) ReactDOM.unmountComponentAtNode(header);
    panelRoot.remove();
  }

  teardownSplitView();
  cleanupObservers();
};

export const panelManager = {
  toggle: ({
    tag,
    blockUid,
    onloadArgs,
  }: {
    tag: string;
    blockUid: string;
    onloadArgs: OnloadArgs;
  }) => {
    if (openPanels.has(tag)) {
      panelManager.removePanel(tag);
    } else {
      panelManager.addPanel({ tag, blockUid, onloadArgs });
    }
  },

  addPanel: ({
    tag,
    blockUid,
    onloadArgs,
  }: {
    tag: string;
    blockUid: string;
    onloadArgs: OnloadArgs;
  }) => {
    try {
      let panelsContainer = document.getElementById(PANELS_CONTAINER_ID);
      if (!panelsContainer) {
        panelsContainer = createPanelInfrastructure();
        if (!panelsContainer) {
          console.error("Failed to create panel infrastructure");
          return;
        }
      }

      const panelElement = document.createElement("div");
      panelElement.id = `discourse-panel-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`;
      panelElement.style.cssText = STYLES.panelElement;

      const header = panelsContainer.querySelector(
        "#discourse-suggestions-header",
      );
      if (header && header.nextSibling) {
        panelsContainer.insertBefore(panelElement, header.nextSibling);
      } else {
        panelsContainer.appendChild(panelElement);
      }

      openPanels.set(tag, { blockUid, element: panelElement, onloadArgs });

      ReactDOM.render(
        <ExtensionApiContextProvider {...onloadArgs}>
          <DiscourseSuggestionsPanel
            tag={tag}
            blockUid={blockUid}
            onClose={() => panelManager.removePanel(tag)}
          />
        </ExtensionApiContextProvider>,
        panelElement,
      );
    } catch (error) {
      console.error(`Failed to add panel for ${tag}:`, error);
    }
  },

  removePanel: (tag: string) => {
    try {
      const panelInfo = openPanels.get(tag);
      if (!panelInfo) return;

      ReactDOM.unmountComponentAtNode(panelInfo.element);
      panelInfo.element.remove();
      openPanels.delete(tag);

      if (openPanels.size === 0) {
        cleanupPanelInfrastructure();
      }
    } catch (error) {
      console.error(`Failed to remove panel ${tag}:`, error);
      openPanels.delete(tag);
    }
  },

  closeAll: () => {
    try {
      isContainerMinimized = false;
      cleanupPanelInfrastructure();
    } catch (error) {
      console.error("Failed to close all panels:", error);
      openPanels.clear();
      isContainerMinimized = false;
    }
  },

  toggleContainerMinimize: () => {
    const panelsContainer = document.getElementById(PANELS_CONTAINER_ID);
    const panelRoot = document.getElementById(PANEL_ROOT_ID);

    if (!panelsContainer || !panelRoot) return;

    isContainerMinimized = !isContainerMinimized;

    if (isContainerMinimized) {
      panelsContainer.style.display = "none";
      panelRoot.style.flex = "0 0 auto";
      panelRoot.style.width = "auto";
      createMinimizedBar(panelRoot);

      const roamBodyMain = getRoamBodyMain();
      const articleWrapper = roamBodyMain
        ? getArticleWrapper(roamBodyMain)
        : null;
      if (articleWrapper) articleWrapper.style.flex = "1 1 auto";
    } else {
      panelsContainer.style.display = "flex";
      removeMinimizedBar();
      panelRoot.style.flex = "0 0 40%";
      panelRoot.style.width = "";

      const roamBodyMain = getRoamBodyMain();
      const articleWrapper = roamBodyMain
        ? getArticleWrapper(roamBodyMain)
        : null;
      if (articleWrapper) articleWrapper.style.flex = "1 1 60%";
    }
  },

  isOpen: (tag: string) => openPanels.has(tag),
  isContainerMinimized: () => isContainerMinimized,
};
