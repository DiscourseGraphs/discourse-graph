import React from "react";
import { createIconButton } from "roamjs-components/dom";

const splitMainContent = () => {
  const mainContent = document.querySelector(".roam-main .roam-body-main");
  if (mainContent) {
    // This is a placeholder for the actual split view logic.
    console.log("Splitting main content...");
  }
};

export const SplitViewButton = () => {
  const [button, setButton] = React.useState<HTMLSpanElement | null>(null);

  React.useEffect(() => {
    const newButton = createIconButton("split-view");
    newButton.onclick = splitMainContent;
    newButton.setAttribute("title", "Split View");

    const topbar = document.querySelector(".rm-topbar");
    const helpButton = document.querySelector(".rm-topbar__help");

    if (topbar) {
      if (helpButton) {
        topbar.insertBefore(newButton, helpButton);
      } else {
        topbar.appendChild(newButton);
      }
      setButton(newButton);
    }

    return () => {
      button?.remove();
    };
  }, []);

  return null;
};
