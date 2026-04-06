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
  Divider,
  Position,
  PopoverInteractionKind,
  TabId,
} from "@blueprintjs/core";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import extractRef from "roamjs-components/util/extractRef";
import {
  onSettingChange,
  settingKeys,
} from "~/components/settings/utils/settingsEmitter";
import {
  type LeftSidebarConfig,
  type LeftSidebarPersonalSectionConfig,
  mergeGlobalSectionWithAccessor,
  mergePersonalSectionsWithAccessor,
} from "~/utils/getLeftSidebarSettings";
import discourseConfigRef, { notify } from "~/utils/discourseConfigRef";
import { getLeftSidebarSettings } from "~/utils/getLeftSidebarSettings";
import {
  getGlobalSetting,
  getPersonalSetting,
  getPersonalSettings,
  setGlobalSetting,
  setPersonalSetting,
  type SettingsSnapshot,
} from "~/components/settings/utils/accessors";
import {
  PERSONAL_KEYS,
  GLOBAL_KEYS,
  LEFT_SIDEBAR_KEYS,
  LEFT_SIDEBAR_SETTINGS_KEYS,
} from "~/components/settings/utils/settingKeys";
import type { LeftSidebarGlobalSettings } from "~/components/settings/utils/zodSchema";
import { createBlock } from "roamjs-components/writes";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { Dispatch, SetStateAction } from "react";
import { SettingsDialog } from "./settings/Settings";
import { OnloadArgs } from "roamjs-components/types";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/data/constants";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { migrateLeftSidebarSettings } from "~/utils/migrateLeftSidebarSettings";
import posthog from "posthog-js";

const getCurrentLeftSidebarConfig = (): LeftSidebarConfig =>
  getLeftSidebarSettings(discourseConfigRef.tree);

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
  posthog.capture("Left Sidebar: Target Opened", {
    targetType: target.type,
    openInSidebar: e.shiftKey,
  });
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

const toggleFoldedState = async ({
  isOpen,
  setIsOpen,
  folded,
  parentUid,
  isGlobal,
  sectionIndex,
}: {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  folded: { uid?: string; value: boolean };
  parentUid: string;
  isGlobal?: boolean;
  sectionIndex?: number;
}) => {
  const newFolded = !isOpen;

  if (isOpen) {
    const children = getBasicTreeByParentUid(parentUid);
    await Promise.all(
      children
        .filter((c) => c.text === "Folded")
        .map((c) => deleteBlock(c.uid)),
    );
    folded.uid = undefined;
    folded.value = false;
  } else {
    const newUid = window.roamAlphaAPI.util.generateUID();
    await createBlock({
      parentUid,
      node: { text: "Folded", uid: newUid },
    });
    folded.uid = newUid;
    folded.value = true;
  }

  refreshConfigTree();

  if (isGlobal) {
    setGlobalSetting(
      [
        GLOBAL_KEYS.leftSidebar,
        LEFT_SIDEBAR_KEYS.settings,
        LEFT_SIDEBAR_SETTINGS_KEYS.folded,
      ],
      newFolded,
    );
  } else if (sectionIndex !== undefined) {
    const sections = [...getPersonalSettings()[PERSONAL_KEYS.leftSidebar]];
    if (sections[sectionIndex]) {
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        Settings: {
          ...sections[sectionIndex].Settings,
          Folded: newFolded,
        },
      };
      setPersonalSetting([PERSONAL_KEYS.leftSidebar], sections);
    }
  }

  setIsOpen(newFolded);
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
  section,
  sectionIndex,
}: {
  section: LeftSidebarPersonalSectionConfig;
  sectionIndex: number;
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

    void toggleFoldedState({
      isOpen,
      setIsOpen,
      folded: section.settings.folded,
      parentUid: section.settings.uid || "",
      sectionIndex,
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
      {sections.map((section, index) => (
        <div key={section.uid}>
          <PersonalSectionItem section={section} sectionIndex={index} />
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
          void toggleFoldedState({
            isOpen,
            setIsOpen,
            folded: config.settings.folded,
            parentUid: config.settings.uid,
            isGlobal: true,
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

// TODO(ENG-1471): Remove old-system merge when migration complete — just use accessor values directly.
// See mergeGlobalSectionWithAccessor/mergePersonalSectionsWithAccessor for why the merge exists.
const buildConfig = (snapshot?: SettingsSnapshot): LeftSidebarConfig => {
  // Read VALUES from accessor (handles flag routing + mismatch detection)
  const globalValues = snapshot
    ? snapshot.globalSettings[GLOBAL_KEYS.leftSidebar]
    : getGlobalSetting<LeftSidebarGlobalSettings>([GLOBAL_KEYS.leftSidebar]);
  const personalValues = snapshot
    ? snapshot.personalSettings[PERSONAL_KEYS.leftSidebar]
    : getPersonalSetting<
        ReturnType<typeof getPersonalSettings>[typeof PERSONAL_KEYS.leftSidebar]
      >([PERSONAL_KEYS.leftSidebar]);

  // Read UIDs from old system (needed for fold CRUD during dual-write)
  const oldConfig = getCurrentLeftSidebarConfig();

  return {
    uid: oldConfig.uid,
    favoritesMigrated: oldConfig.favoritesMigrated,
    sidebarMigrated: oldConfig.sidebarMigrated,
    global: mergeGlobalSectionWithAccessor(oldConfig.global, globalValues),
    personal: {
      uid: oldConfig.personal.uid,
      sections: mergePersonalSectionsWithAccessor(
        oldConfig.personal.sections,
        personalValues,
      ),
    },
    allPersonalSections: oldConfig.allPersonalSections,
  };
};

export const useConfig = (initialSnapshot?: SettingsSnapshot) => {
  const [config, setConfig] = useState(() => buildConfig(initialSnapshot));
  useEffect(() => {
    const handleUpdate = () => {
      setConfig(buildConfig());
    };
    const unsubGlobal = onSettingChange(
      settingKeys.globalLeftSidebar,
      handleUpdate,
    );
    const unsubPersonal = onSettingChange(
      settingKeys.personalLeftSidebar,
      handleUpdate,
    );
    return () => {
      unsubGlobal();
      unsubPersonal();
    };
  }, []);
  return { config, setConfig };
};

// TODO(ENG-1471): refreshAndNotify still needed by settings panels
// (LeftSidebarGlobalSettings, LeftSidebarPersonalSettings) for old-system CRUD.
// Remove when settings panels also read via accessors + emitter.
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

const LeftSidebarView = ({
  onloadArgs,
  initialSnapshot,
}: {
  onloadArgs: OnloadArgs;
  initialSnapshot?: SettingsSnapshot;
}) => {
  const { config } = useConfig(initialSnapshot);

  return (
    <>
      <FavoritesPopover onloadArgs={onloadArgs} />
      <GlobalSection config={config.global} />
      <PersonalSections config={config} />
    </>
  );
};

const migrateFavorites = async () => {
  const config = getCurrentLeftSidebarConfig();

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
  initialSnapshot?: SettingsSnapshot,
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
  ReactDOM.render(
    <LeftSidebarView onloadArgs={onloadArgs} initialSnapshot={initialSnapshot} />,
    root,
  );
};

export default LeftSidebarView;
