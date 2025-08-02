import React, { useEffect, useRef } from "react";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import { createIconButton } from "roamjs-components/dom";

const PANEL_ROOT_ID = "discourse-graph-suggestions-root";

export const SplitViewButton = () => {
  const originalStylesRef = useRef<{
    roamBodyMain: string;
    mainContent: string;
  } | null>(null);

  const extensionAPI = useExtensionAPI();

  const toggleSplitView = () => {
    const roamBodyMain = document.querySelector(
      ".roam-body-main",
    ) as HTMLElement | null;
    if (!roamBodyMain) return;

    const panelRoot = document.getElementById(
      PANEL_ROOT_ID,
    ) as HTMLElement | null;
    const isSplit = roamBodyMain.dataset.isSplit === "true";
    console.log("isSplit", isSplit);

    if (isSplit) {
      // HIDE split view but keep its DOM so that panels persist
      if (panelRoot) {
        panelRoot.style.display = "none";
      }

      const mainContent = panelRoot?.nextElementSibling as HTMLElement | null;
      console.log("mainContent on close", mainContent);

      const original = originalStylesRef.current;
      if (original) {
        // Restore original styles that existed before we first split
        roamBodyMain.style.cssText = original.roamBodyMain;
        if (mainContent) mainContent.style.cssText = original.mainContent;
      }

      roamBodyMain.removeAttribute("data-is-split");
      if (mainContent) {
        mainContent.classList.remove("rm-spacing--large");
        mainContent.classList.add("rm-spacing--medium");
      }
      // NOTE: we intentionally do NOT unmount or remove the panelRoot so that
      // its React tree (and state) survive until the next time we show it.
      originalStylesRef.current = null;
    } else {
      // OPEN split view
      const mainContent = roamBodyMain.firstElementChild as HTMLElement | null;
      console.log("mainContent on open", mainContent);
      if (!mainContent) return;

      originalStylesRef.current = {
        roamBodyMain: roamBodyMain.style.cssText,
        mainContent: mainContent.style.cssText,
      };

      let root = panelRoot;
      // If a root already exists (because we previously hid it), just show it.
      if (root) {
        root.style.display = "block";
      } else {
        // First-time open: create the root; it will be populated when the
        // user opens a suggestions panel.
        root = document.createElement("div");
        root.id = PANEL_ROOT_ID;
        roamBodyMain.insertBefore(root, mainContent);
      }

      roamBodyMain.style.display = "flex";
      root.style.flex = "0 0 40%";
      mainContent.style.flex = "1 1 60%";
      roamBodyMain.dataset.isSplit = "true";
      if (mainContent) {
        mainContent.classList.remove("rm-spacing--small");
        mainContent.classList.add("rm-spacing--large");
      }
    }
  };

  useEffect(() => {
    if (!extensionAPI?.settings.get("suggestion-display-split-view")) {
      return; // do not render icon if split view disabled
    }

    const newButton = createIconButton("split-columns");
    newButton.classList.add("bp3-minimal", "bp3-small");
    newButton.onclick = toggleSplitView;
    newButton.setAttribute("title", "Split View");

    const topbar = document.querySelector(".rm-topbar");
    const helpButton = document.querySelector(".rm-topbar__help");

    if (topbar) {
      const existingButton = topbar.querySelector(`[title="Split View"]`);
      if (existingButton) {
        existingButton.remove();
      }

      if (helpButton) {
        topbar.insertBefore(newButton, helpButton);
      } else {
        topbar.appendChild(newButton);
      }
    }

    const unmount = () => {
      if (document.querySelector('.roam-body-main[data-is-split="true"]')) {
        toggleSplitView();
      }
      newButton.remove();
    };

    return unmount;
  }, []);

  return null;
};
