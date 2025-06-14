import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { createIconButton } from "roamjs-components/dom";
import { DiscourseSuggestionsPanel } from "./DiscourseSuggestionsPanel";

const PANEL_ROOT_ID = "discourse-graph-suggestions-root";

export const SplitViewButton = () => {
  const originalStylesRef = useRef<{
    roamBodyMain: string;
    mainContent: string;
  } | null>(null);

  const toggleSplitView = () => {
    const roamBodyMain = document.querySelector(
      ".roam-body-main",
    ) as HTMLElement | null;
    if (!roamBodyMain) return;

    const isSplit = roamBodyMain.dataset.isSplit === "true";

    if (isSplit) {
      const panelRoot = document.getElementById(PANEL_ROOT_ID);
      if (panelRoot) {
        ReactDOM.unmountComponentAtNode(panelRoot);
        panelRoot.remove();
      }

      const original = originalStylesRef.current;
      if (original) {
        const mainContent =
          roamBodyMain.firstElementChild as HTMLElement | null;
        roamBodyMain.style.cssText = original.roamBodyMain;
        if (mainContent) mainContent.style.cssText = original.mainContent;
      }

      roamBodyMain.removeAttribute("data-is-split");
      originalStylesRef.current = null;
    } else {
      const mainContent = roamBodyMain.firstElementChild as HTMLElement | null;
      if (!mainContent) return;

      originalStylesRef.current = {
        roamBodyMain: roamBodyMain.style.cssText,
        mainContent: mainContent.style.cssText,
      };

      const panelRoot = document.createElement("div");
      panelRoot.id = PANEL_ROOT_ID;

      roamBodyMain.insertBefore(panelRoot, mainContent);

      roamBodyMain.style.display = "flex";
      panelRoot.style.flex = "0 0 40%";
      mainContent.style.flex = "1 1 60%";
      roamBodyMain.dataset.isSplit = "true";

      ReactDOM.render(
        <DiscourseSuggestionsPanel onClose={toggleSplitView} />,
        panelRoot,
      );
    }
  };

  useEffect(() => {
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
