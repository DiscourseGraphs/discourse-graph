import React from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { AdvancedSearchSidebarPanel } from "./AdvancedSearchSidebarPanel";
import type { AdvancedNodeSearchSession } from "./advancedSearchSession";

const SIDEBAR_ROOT_ID = "dg-node-search-sidebar-root";

let unmountSidebarSearch: (() => void) | null = null;

const waitForLatestSidebarWindow = async (): Promise<HTMLElement> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const windows =
      document.querySelectorAll<HTMLElement>(".rm-sidebar-window");
    const latest = windows[windows.length - 1];
    if (latest) return latest;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }
  throw new Error("Sidebar window did not appear");
};

const setSidebarWindowTitle = (windowEl: HTMLElement): void => {
  const titleEl = windowEl.querySelector<HTMLElement>(
    ".window-headers span[style*='font-weight']",
  );
  if (titleEl) titleEl.textContent = "DG node search";
};

const mountPanelInSidebarWindow = ({
  session,
  windowEl,
}: {
  session: AdvancedNodeSearchSession;
  windowEl: HTMLElement;
}): void => {
  unmountSidebarSearch?.();
  unmountSidebarSearch = null;

  const outlineWrapper = windowEl.querySelector(".rm-sidebar-outline-wrapper");
  if (!outlineWrapper) {
    throw new Error("Sidebar outline wrapper not found");
  }

  outlineWrapper.innerHTML = "";

  const root = document.createElement("div");
  root.id = SIDEBAR_ROOT_ID;
  root.className =
    "rm-sidebar-search dg-node-search-sidebar-root box-border w-full";
  root.onmousedown = (event) => event.stopPropagation();
  outlineWrapper.appendChild(root);

  unmountSidebarSearch = renderWithUnmount(
    <AdvancedSearchSidebarPanel initialSession={session} />,
    root,
  );
};

export const openDgSearchInSidebar = async (
  session: AdvancedNodeSearchSession,
): Promise<void> => {
  const anchorPageUid = window.roamAlphaAPI.util.dateToPageUid(new Date());

  await window.roamAlphaAPI.ui.rightSidebar.addWindow({
    window: {
      type: "outline",
      // @ts-expect-error - block-uid is valid for outline sidebar windows
      // eslint-disable-next-line @typescript-eslint/naming-convention
      "block-uid": anchorPageUid,
    },
  });

  const sidebarWindow = await waitForLatestSidebarWindow();
  setSidebarWindowTitle(sidebarWindow);
  mountPanelInSidebarWindow({ session, windowEl: sidebarWindow });
};

export const unmountDgSearchSidebar = (): void => {
  unmountSidebarSearch?.();
  unmountSidebarSearch = null;
  document.getElementById(SIDEBAR_ROOT_ID)?.remove();
};
