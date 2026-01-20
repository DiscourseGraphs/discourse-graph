/* eslint-disable @typescript-eslint/naming-convention */
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import {
  Collapse,
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
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import extractRef from "roamjs-components/util/extractRef";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import { createBlock } from "roamjs-components/writes";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { SettingsDialog } from "./settings/Settings";
import { OnloadArgs } from "roamjs-components/types";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import {
  useLeftSidebarGlobalSettings,
  useLeftSidebarPersonalSettings,
} from "./settings/utils/hooks";
import { getGlobalSetting, setGlobalSetting, setPersonalSetting } from "./settings/utils/accessors";
import type { LeftSidebarGlobalSettings } from "./settings/utils/zodSchema";
import type { PersonalSection } from "./settings/utils/zodSchema";

const parseReference = (text: string) => {
  const extracted = extractRef(text);
  if (text.startsWith("((") && text.endsWith("))")) {
    return { type: "block" as const, uid: extracted, display: text };
  } else {
    return { type: "page" as const, display: text };
  }
};

const truncate = (s: string, max: number | undefined): string => {
  if (!max || max <= 0) return s;
  return s.length > max ? `${s.slice(0, max)}...` : s;
};

const openTarget = async (e: React.MouseEvent, targetUid: string) => {
  e.preventDefault();
  e.stopPropagation();
  const target = parseReference(targetUid);
  if (target.type === "block") {
    if (e.shiftKey) {
      await openBlockInSidebar(target.uid);
      return;
    }
    await window.roamAlphaAPI.ui.mainWindow.openBlock({
      block: { uid: target.uid },
    });
    return;
  }

  if (e.shiftKey) {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      // @ts-expect-error - todo test
      // eslint-disable-next-line @typescript-eslint/naming-convention
      window: { type: "outline", "block-uid": targetUid },
    });
  } else {
    await window.roamAlphaAPI.ui.mainWindow.openPage({
      page: { uid: targetUid },
    });
  }
};

const SectionChildren = ({
  childrenNodes,
  truncateAt,
}: {
  childrenNodes: { uid: string; text: string; alias?: { value: string } }[];
  truncateAt?: number;
}) => {
  if (!childrenNodes?.length) return null;
  return (
    <>
      {childrenNodes.map((child) => {
        const ref = parseReference(child.text);
        const alias = child.alias?.value;
        const display =
          ref.type === "page"
            ? getPageTitleByPageUid(ref.display)
            : getTextByBlockUid(ref.uid);
        const label = alias || truncate(display, truncateAt);
        const onClick = (e: React.MouseEvent) => {
          return void openTarget(e, child.text);
        };
        return (
          <div key={child.uid} className="pl-8 pr-2.5">
            <div
              className={
                "section-child-item page cursor-pointer rounded-sm leading-normal text-gray-600"
              }
              onClick={onClick}
            >
              {label}
            </div>
          </div>
        );
      })}
    </>
  );
};

const PersonalSectionItem = ({
  sectionName,
  section,
  onToggleFolded,
}: {
  sectionName: string;
  section: PersonalSection;
  onToggleFolded: (sectionName: string) => void;
}) => {
  const truncateAt = section.Settings?.["Truncate-result?"];
  const [isOpen, setIsOpen] = useState<boolean>(section.Settings?.Folded ?? false);

  useEffect(() => {
    setIsOpen(section.Settings?.Folded ?? false);
  }, [section.Settings?.Folded]);

  const handleChevronClick = useCallback(() => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggleFolded(sectionName);
  }, [isOpen, sectionName, onToggleFolded]);

  const childrenNodes = section.Children.map((child) => ({
    uid: child.Page,
    text: child.Page,
    alias: child.Alias ? { value: child.Alias } : undefined,
  }));

  return (
    <>
      <div className="sidebar-title-button flex w-full cursor-pointer items-center border-none bg-transparent pl-6 pr-2.5 font-semibold outline-none">
        <div className="flex w-full items-center justify-between">
          <div
            className="flex items-center"
            onClick={() => {
              if (section.Children.length > 0) {
                handleChevronClick();
              }
            }}
          >
            {sectionName.toUpperCase()}
          </div>
          {section.Children.length > 0 && (
            <span
              className="sidebar-title-button-chevron p-1"
              onClick={handleChevronClick}
            >
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          )}
        </div>
      </div>
      <Collapse isOpen={isOpen}>
        <SectionChildren childrenNodes={childrenNodes} truncateAt={truncateAt} />
      </Collapse>
    </>
  );
};

const PersonalSections = () => {
  const personalSettings = useLeftSidebarPersonalSettings();
  const sections = Object.entries(personalSettings);

  const handleToggleFolded = useCallback(
    (sectionName: string) => {
      const section = personalSettings[sectionName];
      if (!section) return;
      const newFolded = !section.Settings.Folded;
      setPersonalSetting(["Left Sidebar", sectionName, "Settings", "Folded"], newFolded);
    },
    [personalSettings],
  );

  if (!sections.length) return null;

  return (
    <div className="personal-left-sidebar-sections">
      {sections.map(([name, section]) => (
        <div key={name}>
          <PersonalSectionItem
            sectionName={name}
            section={section}
            onToggleFolded={handleToggleFolded}
          />
        </div>
      ))}
    </div>
  );
};

const GlobalSection = () => {
  const globalSettings = useLeftSidebarGlobalSettings();
  const children = globalSettings.Children || [];
  const isCollapsable = globalSettings.Settings?.Collapsable ?? false;
  const isFolded = globalSettings.Settings?.Folded ?? false;

  const [isOpen, setIsOpen] = useState<boolean>(isFolded);

  useEffect(() => {
    setIsOpen(isFolded);
  }, [isFolded]);

  const handleToggleFold = useCallback(() => {
    if (!isCollapsable) return;
    const newFoldedState = !isOpen;
    setIsOpen(newFoldedState);
    setGlobalSetting(["Left Sidebar", "Settings", "Folded"], newFoldedState);
  }, [isCollapsable, isOpen]);

  if (!children.length) return null;

  const childrenNodes = children.map((uid) => ({
    uid,
    text: uid,
  }));

  return (
    <>
      <div
        className="sidebar-title-button flex w-full items-center border-none bg-transparent py-1 pl-6 pr-2.5 font-semibold outline-none"
        onClick={handleToggleFold}
      >
        <div className="flex w-full items-center justify-between">
          <span>GLOBAL</span>
          {isCollapsable && (
            <span className="sidebar-title-button-chevron p-1">
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          )}
        </div>
      </div>
      {isCollapsable ? (
        <Collapse isOpen={isOpen}>
          <SectionChildren childrenNodes={childrenNodes} />
        </Collapse>
      ) : (
        <SectionChildren childrenNodes={childrenNodes} />
      )}
    </>
  );
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
      <GlobalSection />
      <PersonalSections />
    </>
  );
};

const migrateFavorites = async () => {
  const config = getFormattedConfigTree().leftSidebar;

  if (config.favoritesMigrated.value) return;

  const configPageUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
  if (!configPageUid) return;

  const results = window.roamAlphaAPI.q(`
    [:find ?uid
     :where [?e :page/sidebar]
            [?e :block/uid ?uid]]
  `);
  const favorites = (results as string[][]).map(([uid]) => uid);

  const currentSettings = getGlobalSetting<LeftSidebarGlobalSettings>(["Left Sidebar"]);
  const existingChildren = new Set(currentSettings?.Children || []);
  const newFavorites = favorites.filter((uid) => !existingChildren.has(uid));

  if (newFavorites.length > 0) {
    const mergedChildren = [...(currentSettings?.Children || []), ...newFavorites];
    setGlobalSetting(["Left Sidebar", "Children"], mergedChildren);
  }

  let leftSidebarUid = config.uid;
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

  await createBlock({
    parentUid: leftSidebarUid,
    node: { text: "Favorites Migrated" },
  });
  refreshConfigTree();
};

let cachedOnloadArgs: OnloadArgs | null = null;

export const cacheOnloadArgs = (onloadArgs: OnloadArgs): void => {
  cachedOnloadArgs = onloadArgs;
};

export const mountLeftSidebar = async (
  wrapper: HTMLElement,
  onloadArgs: OnloadArgs,
): Promise<void> => {
  if (!wrapper) return;

  cachedOnloadArgs = onloadArgs;

  const id = "dg-left-sidebar-root";
  let root = wrapper.querySelector(`#${id}`) as HTMLDivElement;
  if (!root) {
    await migrateFavorites();
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

export const unmountLeftSidebar = (): void => {
  const wrapper = document.querySelector(".starred-pages-wrapper") as HTMLDivElement;
  if (!wrapper) return;

  const root = wrapper.querySelector("#dg-left-sidebar-root") as HTMLDivElement;
  if (root) {
    ReactDOM.unmountComponentAtNode(root);
    root.remove();
  }
  wrapper.style.padding = "";
};

export const remountLeftSidebar = async (): Promise<void> => {
  const wrapper = document.querySelector(".starred-pages-wrapper") as HTMLDivElement;
  if (!wrapper || !cachedOnloadArgs) return;

  wrapper.style.padding = "0";
  await mountLeftSidebar(wrapper, cachedOnloadArgs);
};

export default LeftSidebarView;
