import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import { arrayMove } from "@dnd-kit/sortable";
import { SortableList, type SortableHandle } from "./SortableList";
import { moveRoamBlockToIndex } from "~/utils/moveRoamBlock";
import {
  Button,
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
  isQueryBlockRef,
  type LeftSidebarConfig,
  type LeftSidebarPersonalSectionConfig,
  mergeGlobalSectionWithAccessor,
  mergePersonalSectionsWithAccessor,
} from "~/utils/getLeftSidebarSettings";
import runQuery from "~/utils/runQuery";
import { sectionsToBlockProps } from "./settings/LeftSidebarPersonalSettings";
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
import { commands, cleanCommandName } from "~/components/LeftSidebarCommands";
import { isSmartBlockUid } from "~/utils/isSmartBlockUid";
import { RenderRoamBlock } from "~/utils/roamReactComponents";

const getCurrentLeftSidebarConfig = (): LeftSidebarConfig =>
  getLeftSidebarSettings(discourseConfigRef.tree);

const parseReference = (text: string) => {
  const extracted = extractRef(text);
  if (commands[text]) {
    return { type: "command" as const, uid: text, display: text };
  } else if (text.startsWith("((") && text.endsWith("))")) {
    return { type: "block" as const, uid: extracted, display: text };
  } else {
    return { type: "page" as const, display: text };
  }
};

const truncate = (s: string, max: number | undefined): string => {
  if (!max || max <= 0) return s;
  return s.length > max ? `${s.slice(0, max)}...` : s;
};

const openTarget = async (
  e: React.MouseEvent,
  targetUid: string,
  onloadArgs: OnloadArgs,
) => {
  e.preventDefault();
  e.stopPropagation();
  const target = parseReference(targetUid);
  posthog.capture("Left Sidebar: Target Opened", {
    targetType: target.type,
    openInSidebar: e.shiftKey,
  });
  if (target.type === "command") {
    await commands[target.uid](onloadArgs);
    return;
  }
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
  sectionIndex,
}: {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
  folded: { uid?: string; value: boolean };
  parentUid: string;
  sectionIndex: number;
}) => {
  const newFolded = !isOpen;
  setIsOpen(newFolded);

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
};

const RoamRenderedBlock = ({
  uid,
  onNavigate,
}: {
  uid: string;
  onNavigate: (e: React.MouseEvent) => void;
}) => {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const pattern = "[:block/string]";
    const entityId = `[:block/uid "${uid}"]`;
    const callback = () => setVersion((v) => v + 1);
    window.roamAlphaAPI.data.addPullWatch(pattern, entityId, callback);
    return () => {
      window.roamAlphaAPI.data.removePullWatch(pattern, entityId, callback);
    };
  }, [uid]);

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    onNavigate(e);
  };

  return (
    <div className="dg-sidebar-rendered-block" onClick={handleClick}>
      <RenderRoamBlock key={version} uid={uid} open={false} />
    </div>
  );
};

type ChildNode = { uid: string; text: string; alias?: { value: string } };

const ChildRow = ({
  child,
  truncateAt,
  onloadArgs,
}: {
  child: ChildNode;
  truncateAt?: number;
  onloadArgs: OnloadArgs;
}) => {
  const ref = parseReference(child.text);

  if (ref.type === "block" && isSmartBlockUid(ref.uid)) {
    return (
      <div className="pl-8 pr-2.5">
        <div className="section-child-item cursor-pointer rounded-sm leading-normal text-gray-600">
          <RoamRenderedBlock
            uid={ref.uid}
            onNavigate={(e) => void openTarget(e, child.text, onloadArgs)}
          />
        </div>
      </div>
    );
  }

  const alias = child.alias?.value;
  const display =
    ref.type === "command"
      ? ref.display
      : ref.type === "page"
        ? getPageTitleByPageUid(ref.display)
        : getTextByBlockUid(ref.uid);
  const label = alias || truncate(display, truncateAt);
  const onClick = (e: React.MouseEvent) => {
    return void openTarget(e, child.text, onloadArgs);
  };
  return (
    <div className="pl-8 pr-2.5">
      {ref.type === "command" ? (
        <span className="bp3-dark">
          <Button onClick={onClick} minimal className="m-px">
            {cleanCommandName(label)}
          </Button>
        </span>
      ) : (
        <div
          className="section-child-item page cursor-pointer rounded-sm leading-normal text-gray-600"
          onClick={onClick}
        >
          {label}
        </div>
      )}
    </div>
  );
};

const PersonalSectionItem = ({
  section,
  sectionIndex,
  dragHandle,
  onChildrenReorder,
  onloadArgs,
}: {
  section: LeftSidebarPersonalSectionConfig;
  sectionIndex: number;
  dragHandle: SortableHandle;
  onChildrenReorder: (args: {
    sectionUid: string;
    oldIndex: number;
    newIndex: number;
  }) => void;
  onloadArgs: OnloadArgs;
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
  const isTogglingRef = useRef(false);

  const handleChevronClick = async () => {
    if (!section.settings) return;
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    try {
      await toggleFoldedState({
        isOpen,
        setIsOpen,
        folded: section.settings.folded,
        parentUid: section.settings.uid || "",
        sectionIndex,
      });
    } finally {
      isTogglingRef.current = false;
    }
  };

  return (
    <>
      <div
        {...dragHandle.attributes}
        {...dragHandle.listeners}
        className="sidebar-title-button flex w-full cursor-pointer items-center border-none bg-transparent pl-6 pr-2.5 font-semibold outline-none"
      >
        <div className="flex w-full items-center justify-between">
          <div
            className="flex items-center"
            onClick={() => {
              if ((section.children?.length || 0) > 0) {
                void handleChevronClick();
              }
            }}
          >
            {(blockText || titleRef.display).toUpperCase()}
          </div>
          {(section.children?.length || 0) > 0 && (
            <span
              className="sidebar-title-button-chevron p-1"
              onClick={() => void handleChevronClick()}
            >
              <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
            </span>
          )}
        </div>
      </div>
      <Collapse isOpen={isOpen}>
        <SortableList
          items={section.children || []}
          getId={(c) => c.uid}
          onReorder={(oldIndex, newIndex) =>
            onChildrenReorder({ sectionUid: section.uid, oldIndex, newIndex })
          }
          renderItem={(child, handle) => (
            <div {...handle.attributes} {...handle.listeners}>
              <ChildRow
                child={child}
                truncateAt={truncateAt}
                onloadArgs={onloadArgs}
              />
            </div>
          )}
        />
      </Collapse>
    </>
  );
};

const QuerySectionItem = ({
  section,
  sectionIndex,
  dragHandle,
  onloadArgs,
}: {
  section: LeftSidebarPersonalSectionConfig;
  sectionIndex: number;
  dragHandle: SortableHandle;
  onloadArgs: OnloadArgs;
}) => {
  const queryUid = extractRef(section.text);
  const alias = section.settings?.alias?.value;
  const queryLabel = useMemo(() => getTextByBlockUid(queryUid), [queryUid]);
  const displayName = alias || queryLabel || section.text;
  const truncateAt = section.settings?.truncateResult.value;
  const resultLimit = Math.max(
    0,
    Math.trunc(section.settings?.resultLimit?.value ?? 10),
  );

  const [isOpen, setIsOpen] = useState<boolean>(
    !!section.settings?.folded.value,
  );
  const [results, setResults] = useState<ChildNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isTogglingRef = useRef(false);

  const loadResults = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { allProcessedResults } = await runQuery({
        parentUid: queryUid,
        extensionAPI: onloadArgs.extensionAPI,
      });
      const children: ChildNode[] = allProcessedResults.map((r) => {
        const isPage = !!getPageTitleByPageUid(r.uid);
        return {
          uid: r.uid,
          text: isPage ? r.uid : `((${r.uid}))`,
        };
      });
      setResults(children);
    } catch (e) {
      console.error(e);
      setError("Query failed to run");
    } finally {
      setIsLoading(false);
      setHasCompletedInitialLoad(true);
    }
  }, [queryUid, onloadArgs.extensionAPI]);

  useEffect(() => {
    if (isOpen && !hasCompletedInitialLoad) {
      void loadResults();
    }
  }, [isOpen, hasCompletedInitialLoad, loadResults]);

  const handleChevronClick = async () => {
    if (!section.settings) return;
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    try {
      await toggleFoldedState({
        isOpen,
        setIsOpen,
        folded: section.settings.folded,
        parentUid: section.settings.uid || "",
        sectionIndex,
      });
    } finally {
      isTogglingRef.current = false;
    }
  };

  const limitedResults =
    resultLimit > 0 ? results.slice(0, resultLimit) : results;

  let body: React.ReactNode = null;
  if (isLoading) {
    body = <div className="pl-8 pr-2.5 text-sm text-gray-500">Loading…</div>;
  } else if (error) {
    body = <div className="pl-8 pr-2.5 text-sm text-red-500">{error}</div>;
  } else if (limitedResults.length > 0) {
    body = limitedResults.map((child) => (
      <ChildRow
        key={child.uid}
        child={child}
        truncateAt={truncateAt}
        onloadArgs={onloadArgs}
      />
    ));
  } else if (hasCompletedInitialLoad) {
    body = <div className="pl-8 pr-2.5 text-sm text-gray-500">No results</div>;
  }

  return (
    <>
      <div
        {...dragHandle.attributes}
        {...dragHandle.listeners}
        className="sidebar-title-button flex w-full cursor-pointer items-center border-none bg-transparent pl-6 pr-2.5 font-semibold outline-none"
      >
        <div className="flex w-full items-center justify-between">
          <div
            className="flex flex-1 items-center"
            onClick={() => void handleChevronClick()}
          >
            {displayName.toUpperCase()}
          </div>
          <span
            className="sidebar-title-button-chevron p-1"
            onClick={() => void handleChevronClick()}
          >
            <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
          </span>
          <Popover
            interactionKind={PopoverInteractionKind.CLICK}
            position={Position.BOTTOM_RIGHT}
            autoFocus={false}
            enforceFocus={false}
            captureDismiss
            isOpen={isMenuOpen}
            onInteraction={(next) => setIsMenuOpen(next)}
            onClose={() => setIsMenuOpen(false)}
            popoverClassName="dg-leftsidebar-popover"
            minimal
            content={
              <Menu>
                <MenuItem
                  icon="refresh"
                  text="Refresh"
                  onClick={() => {
                    void loadResults();
                    setIsMenuOpen(false);
                  }}
                />
                <MenuItem
                  icon="document-open"
                  text="Go to query block"
                  onClick={(e) => {
                    void openTarget(e, `((${queryUid}))`, onloadArgs);
                    setIsMenuOpen(false);
                  }}
                />
              </Menu>
            }
          >
            <span className="sidebar-title-button-add p-1">
              <Icon icon="more" size={14} />
            </span>
          </Popover>
        </div>
      </div>
      <Collapse isOpen={isOpen}>{body}</Collapse>
    </>
  );
};

const PersonalSections = ({
  config,
  setConfig,
  onloadArgs,
}: {
  config: LeftSidebarConfig;
  setConfig: Dispatch<SetStateAction<LeftSidebarConfig>>;
  onloadArgs: OnloadArgs;
}) => {
  const sections = config.personal.sections || [];

  if (!sections.length) return null;

  const reorderSections = (oldIndex: number, newIndex: number) => {
    const moved = sections[oldIndex];
    if (!moved) return;
    const reordered = arrayMove(sections, oldIndex, newIndex);
    setConfig({
      ...config,
      personal: { ...config.personal, sections: reordered },
    });
    setPersonalSetting(
      [PERSONAL_KEYS.leftSidebar],
      sectionsToBlockProps(reordered),
    );
    void moveRoamBlockToIndex({
      blockUid: moved.uid,
      parentUid: config.personal.uid,
      sourceIndex: oldIndex,
      destIndex: newIndex,
    }).then(() => {
      refreshAndNotify();
    });
  };

  const reorderChildren = ({
    sectionUid,
    oldIndex,
    newIndex,
  }: {
    sectionUid: string;
    oldIndex: number;
    newIndex: number;
  }) => {
    const section = sections.find((s) => s.uid === sectionUid);
    const children = section?.children;
    if (!section || !children || !section.childrenUid) return;
    const child = children[oldIndex];
    if (!child) return;
    const reorderedChildren = arrayMove(children, oldIndex, newIndex);
    const newSections = sections.map((s) =>
      s.uid === sectionUid ? { ...s, children: reorderedChildren } : s,
    );
    setConfig({
      ...config,
      personal: { ...config.personal, sections: newSections },
    });
    setPersonalSetting(
      [PERSONAL_KEYS.leftSidebar],
      sectionsToBlockProps(newSections),
    );
    void moveRoamBlockToIndex({
      blockUid: child.uid,
      parentUid: section.childrenUid,
      sourceIndex: oldIndex,
      destIndex: newIndex,
    }).then(() => {
      refreshAndNotify();
    });
  };

  return (
    <SortableList
      items={sections}
      getId={(s) => s.uid}
      onReorder={reorderSections}
      className="personal-left-sidebar-sections"
      renderItem={(section, handle) => {
        const sectionIndex = sections.findIndex((s) => s.uid === section.uid);
        if (isQueryBlockRef(section.text) && section.settings?.uid) {
          return (
            <QuerySectionItem
              section={section}
              sectionIndex={sectionIndex}
              dragHandle={handle}
              onloadArgs={onloadArgs}
            />
          );
        }
        return (
          <PersonalSectionItem
            section={section}
            sectionIndex={sectionIndex}
            dragHandle={handle}
            onChildrenReorder={reorderChildren}
            onloadArgs={onloadArgs}
          />
        );
      }}
    />
  );
};

const GlobalSection = ({
  config,
  onGlobalChildrenReorder,
  onloadArgs,
}: {
  config: LeftSidebarConfig["global"];
  onGlobalChildrenReorder: (oldIndex: number, newIndex: number) => void;
  onloadArgs: OnloadArgs;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(!config.settings?.folded.value);
  const isTogglingRef = useRef(false);
  if (!config.children?.length) return null;
  const isCollapsable = config.settings?.collapsable.value;

  const handleToggle = async () => {
    if (!isCollapsable || !config.settings) return;
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    try {
      const settings = config.settings;
      const nextIsOpen = !isOpen;
      setIsOpen(nextIsOpen);
      if (nextIsOpen) {
        const children = getBasicTreeByParentUid(settings.uid);
        await Promise.all(
          children
            .filter((c) => c.text === "Folded")
            .map((c) => deleteBlock(c.uid)),
        );
        settings.folded.uid = undefined;
        settings.folded.value = false;
      } else {
        const newUid = window.roamAlphaAPI.util.generateUID();
        await createBlock({
          parentUid: settings.uid,
          node: { text: "Folded", uid: newUid },
        });
        settings.folded.uid = newUid;
        settings.folded.value = true;
      }
      refreshConfigTree();
      setGlobalSetting(
        [
          GLOBAL_KEYS.leftSidebar,
          LEFT_SIDEBAR_KEYS.settings,
          LEFT_SIDEBAR_SETTINGS_KEYS.folded,
        ],
        !nextIsOpen,
      );
    } finally {
      isTogglingRef.current = false;
    }
  };

  const children = (
    <SortableList
      items={config.children}
      getId={(c) => c.uid}
      onReorder={onGlobalChildrenReorder}
      renderItem={(child, handle) => (
        <div {...handle.attributes} {...handle.listeners}>
          <ChildRow child={child} onloadArgs={onloadArgs} />
        </div>
      )}
    />
  );

  return (
    <>
      <div
        className="sidebar-title-button flex w-full items-center border-none bg-transparent py-1 pl-6 pr-2.5 font-semibold outline-none"
        onClick={() => void handleToggle()}
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
        <Collapse isOpen={isOpen}>{children}</Collapse>
      ) : (
        children
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
  const { config, setConfig } = useConfig(initialSnapshot);

  const reorderGlobalChildren = (oldIndex: number, newIndex: number) => {
    const children = config.global.children;
    if (!children) return;
    const moved = children[oldIndex];
    if (!moved) return;
    const reordered = arrayMove(children, oldIndex, newIndex);
    setConfig({
      ...config,
      global: { ...config.global, children: reordered },
    });
    setGlobalSetting(
      [GLOBAL_KEYS.leftSidebar, LEFT_SIDEBAR_KEYS.children],
      reordered.map((c) => c.text),
    );
    void moveRoamBlockToIndex({
      blockUid: moved.uid,
      parentUid: config.global.childrenUid,
      sourceIndex: oldIndex,
      destIndex: newIndex,
    }).then(() => {
      refreshAndNotify();
    });
  };

  return (
    <>
      <FavoritesPopover onloadArgs={onloadArgs} />
      <GlobalSection
        config={config.global}
        onGlobalChildrenReorder={reorderGlobalChildren}
        onloadArgs={onloadArgs}
      />
      <PersonalSections
        config={config}
        setConfig={setConfig}
        onloadArgs={onloadArgs}
      />
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

export const mountLeftSidebar = async ({
  wrapper,
  onloadArgs,
  initialSnapshot,
}: {
  wrapper: HTMLElement;
  onloadArgs: OnloadArgs;
  initialSnapshot?: SettingsSnapshot;
}): Promise<void> => {
  if (!wrapper) return;

  const styleId = "dg-sidebar-rendered-block-styles";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .dg-sidebar-rendered-block .rm-bullet { display: none; }
      .dg-sidebar-rendered-block .rm-block-separator { display: none; }
      .dg-sidebar-rendered-block .controls { display: none; }
      .dg-sidebar-rendered-block .block-expand { display: none; }
      .dg-sidebar-rendered-block .block-border-left { display: none; }
      .dg-sidebar-rendered-block .block-ref-count-button { display: none; }
      .dg-sidebar-rendered-block .rm-block-main { min-height: unset; padding: 0; }
      .dg-sidebar-rendered-block * { pointer-events: none; }
      .dg-sidebar-rendered-block button,
      .dg-sidebar-rendered-block button * { pointer-events: auto; }
    `;
    document.head.appendChild(style);
  }

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
  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(
    <LeftSidebarView
      onloadArgs={onloadArgs}
      initialSnapshot={initialSnapshot}
    />,
    root,
  );
};

export default LeftSidebarView;
