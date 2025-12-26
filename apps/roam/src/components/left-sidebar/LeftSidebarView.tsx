/* eslint-disable @typescript-eslint/naming-convention */
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  Icon,
  Popover,
  Menu,
  MenuItem,
  Divider,
  Position,
  PopoverInteractionKind,
  TabId,
} from "@blueprintjs/core";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import {
  getFormattedConfigTree,
  notify,
  subscribe,
} from "~/utils/discourseConfigRef";
import { createBlock } from "roamjs-components/writes";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { SettingsDialog } from "../settings/Settings";
import { OnloadArgs } from "roamjs-components/types";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import { migrateLeftSidebarSettings } from "~/utils/migrateLeftSidebarSettings";
import { ViewGlobalLeftSidebar } from "./ViewGlobalLeftSidebar";
import { ViewPersonalLeftSidebar } from "./ViewPersonalLeftSidebar";

export const useConfig = () => {
  const [config, setConfig] = useState(
    () => getFormattedConfigTree().leftSidebar,
  );
  useEffect(() => {
    const handleUpdate = () => {
      setConfig(getFormattedConfigTree().leftSidebar);
    };
    const unsubscribe = subscribe(handleUpdate);
    return () => {
      unsubscribe();
    };
  }, []);
  return { config, setConfig };
};

export const refreshAndNotify = () => {
  refreshConfigTree();
  notify();
};

const FavoritesPopover = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLSpanElement | null>(null);

  const handleGlobalPointerDownCapture = useCallback(
    (e: Event) => {
      if (!isMenuOpen) return;
      const target = e.target as Node | null;
      if (!target) return;

      if (menuTriggerRef.current && menuTriggerRef.current.contains(target)) {
        return;
      }
      const popoverEl = document.querySelector(".dg-leftsidebar-popover");
      if (popoverEl && popoverEl.contains(target)) {
        return;
      }

      setIsMenuOpen(false);
    },
    [isMenuOpen],
  );

  useEffect(() => {
    if (!isMenuOpen) return;
    const opts = { capture: true } as AddEventListenerOptions;
    window.addEventListener(
      "mousedown",
      handleGlobalPointerDownCapture as EventListener,
      opts,
    );
    window.addEventListener(
      "pointerdown",
      handleGlobalPointerDownCapture as EventListener,
      opts,
    );
    return () => {
      window.removeEventListener(
        "mousedown",
        handleGlobalPointerDownCapture as EventListener,
        opts,
      );
      window.removeEventListener(
        "pointerdown",
        handleGlobalPointerDownCapture as EventListener,
        opts,
      );
    };
  }, [handleGlobalPointerDownCapture, isMenuOpen]);

  const renderSettingsDialog = (tabId: TabId) => {
    renderOverlay({
      Overlay: SettingsDialog,
      props: {
        onloadArgs,
        selectedTabId: tabId,
      },
    });
  };

  return (
    <>
      <Divider className="mx-5" style={{ borderColor: "rgb(57, 75, 89)" }} />
      <div style={{ height: "8px" }}></div>
      <div className="flex w-full items-center justify-between pb-1 pl-6 pr-2.5 font-semibold">
        <span className="flex items-baseline">
          <Icon icon="star" iconSize={14} />
          <div style={{ width: 8 }}></div>
          FAVORITES
        </span>
        <Popover
          interactionKind={PopoverInteractionKind.CLICK}
          position={Position.BOTTOM_RIGHT}
          autoFocus={false}
          enforceFocus={false}
          captureDismiss
          hasBackdrop
          isOpen={isMenuOpen}
          onInteraction={(next) => setIsMenuOpen(next)}
          onClose={() => setIsMenuOpen(false)}
          popoverClassName="dg-leftsidebar-popover"
          minimal
          content={
            <Menu>
              <MenuItem
                text="Global Section"
                onClick={() => {
                  renderSettingsDialog("left-sidebar-global-settings");
                  setIsMenuOpen(false);
                }}
              />
              <MenuItem
                text="Personal Section"
                onClick={() => {
                  renderSettingsDialog("left-sidebar-personal-settings");
                  setIsMenuOpen(false);
                }}
              />
            </Menu>
          }
        >
          <span ref={menuTriggerRef} className="sidebar-title-button-add p-1">
            <Icon icon="settings" size={14} />
          </span>
        </Popover>
      </div>
    </>
  );
};

const LeftSidebarView = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  return (
    <>
      <FavoritesPopover onloadArgs={onloadArgs} />
      <ViewGlobalLeftSidebar />
      <ViewPersonalLeftSidebar />
    </>
  );
};

const migrateFavorites = async () => {
  const config = getFormattedConfigTree().leftSidebar;

  if (config.favoritesMigrated.value) return;

  const configPageUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
  if (!configPageUid) return;

  let leftSidebarUid = config.uid;
  if (leftSidebarUid) {
    const leftSidebarTree = getBasicTreeByParentUid(leftSidebarUid);
    const hasAnyPersonalSection = leftSidebarTree.some((node) =>
      node.text.endsWith("/Personal-Section"),
    );
    if (hasAnyPersonalSection) {
      await createBlock({
        parentUid: leftSidebarUid,
        node: { text: "Favorites Migrated" },
      });
      refreshConfigTree();
      return;
    }
  }

  const results = window.roamAlphaAPI.q(`
    [:find ?uid 
     :where [?e :page/sidebar]
            [?e :block/uid ?uid]]
  `);
  const favorites = (results as string[][]).map(([uid]) => ({
    uid,
  }));

  if (!leftSidebarUid) {
    const tree = getBasicTreeByParentUid(configPageUid);
    const found = tree.find((n) => n.text === "Left Sidebar");
    if (found) {
      leftSidebarUid = found.uid;
    } else {
      leftSidebarUid = await createBlock({
        parentUid: configPageUid,
        node: { text: "Left Sidebar" },
      });
    }
  }

  let globalSectionUid = config.global.uid;
  if (!globalSectionUid) {
    const tree = getBasicTreeByParentUid(leftSidebarUid);
    const found = tree.find((n) => n.text === "Global-Section");
    if (found) {
      globalSectionUid = found.uid;
    } else {
      globalSectionUid = await createBlock({
        parentUid: leftSidebarUid,
        node: { text: "Global-Section" },
      });
    }
  }

  let childrenUid = config.global.childrenUid;
  if (!childrenUid) {
    const tree = getBasicTreeByParentUid(globalSectionUid);
    const found = tree.find((n) => n.text === "Children");
    if (found) {
      childrenUid = found.uid;
    } else {
      childrenUid = await createBlock({
        parentUid: globalSectionUid,
        node: { text: "Children" },
      });
    }
  }

  const childrenTree = getBasicTreeByParentUid(childrenUid);
  const existingTexts = new Set(childrenTree.map((c) => c.text));
  const newFavorites = favorites.filter(({ uid }) => !existingTexts.has(uid));

  if (newFavorites.length > 0) {
    await Promise.all(
      newFavorites.map(({ uid }) =>
        createBlock({ parentUid: childrenUid, node: { text: uid } }),
      ),
    );
    refreshAndNotify();
  }

  await createBlock({
    parentUid: leftSidebarUid,
    node: { text: "Favorites Migrated" },
  });
  refreshConfigTree();
};

export const mountLeftSidebar = async (
  wrapper: HTMLElement,
  onloadArgs: OnloadArgs,
): Promise<void> => {
  if (!wrapper) return;

  const id = "dg-left-sidebar-root";
  let root = wrapper.querySelector(`#${id}`) as HTMLDivElement;
  if (!root) {
    await migrateFavorites();
    await migrateLeftSidebarSettings();
    wrapper.innerHTML = "";
    root = document.createElement("div");
    root.id = id;
    root.className = "starred-pages";
    root.onmousedown = (e) => e.stopPropagation();
    wrapper.appendChild(root);
  } else {
    root.className = "starred-pages";
  }
  ReactDOM.render(<LeftSidebarView onloadArgs={onloadArgs} />, root);
};

export const unmountLeftSidebar = (wrapper: HTMLElement): void => {
  if (!wrapper) return;
  const root = wrapper.querySelector(
    `#${"dg-left-sidebar-root"}`,
  ) as HTMLDivElement;
  if (root) {
    ReactDOM.unmountComponentAtNode(root);
    root.remove();
  }
  wrapper.style.padding = "";
};

export default LeftSidebarView;
