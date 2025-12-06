/* eslint-disable @typescript-eslint/naming-convention */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import {
  Collapse,
  Icon,
  Popover,
  Menu,
  MenuItem,
  MenuDivider,
  Divider,
  Position,
  PopoverInteractionKind,
  TabId,
} from "@blueprintjs/core";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import extractRef from "roamjs-components/util/extractRef";
import {
  getFormattedConfigTree,
  notify,
  subscribe,
} from "~/utils/discourseConfigRef";
import type {
  LeftSidebarConfig,
  LeftSidebarPersonalSectionConfig,
} from "~/utils/getLeftSidebarSettings";
import type { BooleanSetting } from "~/utils/getExportSettings";
import { createBlock } from "roamjs-components/writes";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { Dispatch, SetStateAction } from "react";
import { SettingsDialog } from "./settings/Settings";
import { OnloadArgs } from "roamjs-components/types";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";

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

const openTarget = async (e: React.MouseEvent, sectionTitle: string) => {
  e.preventDefault();
  e.stopPropagation();
  const target = parseReference(sectionTitle);
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

  const uid = getPageUidByPageTitle(sectionTitle);
  if (!uid) return;
  if (e.shiftKey) {
    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      // @ts-expect-error - todo test
      // eslint-disable-next-line @typescript-eslint/naming-convention
      window: { type: "outline", "block-uid": uid },
    });
  } else {
    await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
  }
};

const toggleFoldedState = ({
  isOpen,
  setIsOpen,
  folded,
  parentUid,
}: {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  folded: { uid?: string; value: boolean };
  parentUid: string;
}) => {
  if (isOpen) {
    setIsOpen(false);
    if (folded.uid) {
      void deleteBlock(folded.uid);
      folded.uid = undefined;
      folded.value = false;
    }
  } else {
    setIsOpen(true);
    const newUid = window.roamAlphaAPI.util.generateUID();
    void createBlock({
      parentUid,
      node: { text: "Folded", uid: newUid },
    });
    folded.uid = newUid;
    folded.value = true;
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
        const label = alias || truncate(ref.display, truncateAt);
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
  section,
}: {
  section: LeftSidebarPersonalSectionConfig;
}) => {
  const titleRef = parseReference(section.text);
  const blockText = useMemo(
    () =>
      titleRef.type === "block" ? getTextByBlockUid(titleRef.uid) : undefined,
    [titleRef],
  );
  const truncateAt = section.settings?.truncateResult.value;
  const [isOpen, setIsOpen] = useState<boolean>(
    !!section.settings?.folded.value || false,
  );

  const handleChevronClick = () => {
    if (!section.settings) return;

    toggleFoldedState({
      isOpen,
      setIsOpen,
      folded: section.settings.folded,
      parentUid: section.settings.uid || "",
    });
  };

  return (
    <>
      <div className="sidebar-title-button flex w-full cursor-pointer items-center border-none bg-transparent pl-6 pr-2.5 font-semibold outline-none">
        <div className="flex w-full items-center justify-between">
          <div
            className="flex items-center"
            onClick={() => {
              if ((section.children?.length || 0) > 0) {
                handleChevronClick();
              } 
            }}
          >
            {(blockText || titleRef.display).toUpperCase()}
          </div>
          {(section.children?.length || 0) > 0 && (
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
        <SectionChildren
          childrenNodes={section.children || []}
          truncateAt={truncateAt}
        />
      </Collapse>
    </>
  );
};

const PersonalSections = ({ config }: { config: LeftSidebarConfig }) => {
  const sections = config.personal.sections || [];

  if (!sections.length) return null;

  return (
    <div className="personal-left-sidebar-sections">
      {sections.map((section) => (
        <div key={section.uid}>
          <PersonalSectionItem section={section} />
        </div>
      ))}
    </div>
  );
};

const GlobalSection = ({ config }: { config: LeftSidebarConfig["global"] }) => {
  const [isOpen, setIsOpen] = useState<boolean>(
    !!config.settings?.folded.value,
  );
  if (!config.children?.length) return null;
  const isCollapsable = config.settings?.collapsable.value;

  return (
    <>
      <div
        className="sidebar-title-button flex w-full items-center border-none bg-transparent py-1 pl-6 pr-2.5 font-semibold outline-none"
        onClick={() => {
          if (!isCollapsable || !config.settings) return;
          toggleFoldedState({
            isOpen,
            setIsOpen,
            folded: config.settings.folded,
            parentUid: config.settings.uid,
          });
        }}
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
          <SectionChildren childrenNodes={config.children} />
        </Collapse>
      ) : (
        <SectionChildren childrenNodes={config.children} />
      )}
    </>
  );
};

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
              <MenuDivider title="Add Or Edit" />
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
  const { config } = useConfig();

  return (
    <>
      <FavoritesPopover onloadArgs={onloadArgs} />
      <GlobalSection config={config.global} />
      <PersonalSections config={config} />
    </>
  );
};

const migrateFavorites = async () => {
  const configPageUid = getPageUidByPageTitle(DISCOURSE_CONFIG_PAGE_TITLE);
  if (!configPageUid) return;

  const config = getFormattedConfigTree().leftSidebar;

  if ((config.favoritesMigrated as BooleanSetting).value) return;

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
    [:find ?title 
     :where [?e :page/sidebar]
            [?e :node/title ?title]]
  `);
  const titles = (results as string[][]).map(([title]) => title);

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
  const existingTitles = new Set(childrenTree.map((c) => c.text));
  const newTitles = titles.filter((t) => !existingTitles.has(t));

  if (newTitles.length > 0) {
    await Promise.all(
      newTitles.map((text) =>
        createBlock({ parentUid: childrenUid, node: { text } }),
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

export default LeftSidebarView;
