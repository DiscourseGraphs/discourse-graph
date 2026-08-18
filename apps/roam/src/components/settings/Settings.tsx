import React, { useEffect, useMemo, useState } from "react";
import { OnloadArgs } from "roamjs-components/types";
import {
  Classes,
  Dialog,
  Tabs,
  Tab,
  Button,
  TabId,
  Intent,
} from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import DiscourseRelationConfigPanel from "./DiscourseRelationConfigPanel";
import DEFAULT_RELATION_VALUES from "~/data/defaultDiscourseRelations";
import discourseConfigRef from "~/utils/discourseConfigRef";
import DiscourseGraphHome from "./GeneralSettings";
import DiscourseGraphExport from "./ExportSettings";
import QuerySettings from "./QuerySettings";
import AdminPanel from "./AdminPanel";
import DiscourseNodeConfigPanel from "./DiscourseNodeConfigPanel";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import NodeConfig from "./NodeConfig";
import HomePersonalSettings from "./HomePersonalSettings";
import CanvasShortcutSettings from "./CanvasShortcutSettings";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { FeedbackWidget } from "~/components/BirdEatsBugs";
import { getVersionWithDate } from "~/utils/getVersion";
import { LeftSidebarPersonalSections } from "./LeftSidebarPersonalSettings";
import { LeftSidebarGlobalSections } from "./LeftSidebarGlobalSettings";
import posthog from "posthog-js";
import { bulkReadSettings } from "./utils/accessors";
import { onSettingChange, settingKeys } from "./utils/settingsEmitter";

const settingsTabIds = {
  homePersonal: "discourse-graph-home-personal",
  leftSidebarPersonal: "left-sidebar-personal-settings",
  leftSidebarGlobal: "left-sidebar-global-settings",
} as const;

const ADMIN_TAB_ID = "secret-admin-panel";

type SectionHeaderProps = {
  children: React.ReactNode;
  className?: string;
};
const SectionHeader = ({ children, className }: SectionHeaderProps) => {
  return (
    <div
      className={`bp3-tab-copy mt-4 cursor-default select-none font-bold ${className}`}
    >
      {children}
    </div>
  );
};

export const SettingsPanel = ({ onloadArgs }: { onloadArgs: OnloadArgs }) => {
  return (
    <div className="m-4">
      <Button
        onClick={() => {
          posthog.capture("Settings: Opened from Roam Settings Panel");
          render({
            onloadArgs,
          });
        }}
      >
        Open Settings
      </Button>
    </div>
  );
};

export const SettingsDialog = ({
  onloadArgs,
  isOpen,
  onClose,
  selectedTabId,
  expandedSectionUid,
}: {
  onloadArgs: OnloadArgs;
  isOpen?: boolean;
  onClose?: () => void;
  selectedTabId?: TabId;
  expandedSectionUid?: string;
}) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const grammarNode = discourseConfigRef.tree.find(
    (node) => node.text === "grammar",
  );
  const relationsNode = grammarNode?.children.find(
    (node) => node.text === "relations",
  );
  const nodesNode = grammarNode?.children.find((node) => node.text === "nodes");
  const nodes = getDiscourseNodes().filter(excludeDefaultNodes);
  const [activeTabId, setActiveTabId] = useState<TabId>(
    selectedTabId ?? settingsTabIds.homePersonal,
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const settings = useMemo(() => bulkReadSettings(), [activeTabId]);
  const [leftSidebarEnabled, setLeftSidebarEnabled] = useState(
    settings.featureFlags["Enable left sidebar"],
  );
  useEffect(() => {
    return onSettingChange(settingKeys.leftSidebarFlag, (newValue) => {
      setLeftSidebarEnabled(Boolean(newValue));
    });
  }, []);
  const [showAdminPanel, setShowAdminPanel] = useState(
    window.roamAlphaAPI.graph.name === "discourse-graphs" || false,
  );
  const { versionStamp } = getVersionWithDate();
  const openAdminPanel = (): void => {
    setShowAdminPanel(true);
    setActiveTabId(ADMIN_TAB_ID);
    posthog.capture("Settings: Admin Panel Opened from Footer");
  };

  useEffect(() => {
    posthog.capture("Settings: Dialog Opened", {
      initialTabId: String(selectedTabId ?? settingsTabIds.homePersonal),
    });
  }, [selectedTabId]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.stopPropagation();
        e.preventDefault();
        setShowAdminPanel(true);
        setActiveTabId(ADMIN_TAB_ID);
        posthog.capture("Settings: Admin Panel Opened via Shortcut");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);
  const leftSidebarTabHidden =
    !leftSidebarEnabled &&
    (activeTabId === settingsTabIds.leftSidebarPersonal ||
      activeTabId === settingsTabIds.leftSidebarGlobal);
  const visibleTabId = leftSidebarTabHidden
    ? settingsTabIds.homePersonal
    : activeTabId;
  return (
    <Dialog
      isOpen={isOpen}
      onClose={() => {
        refreshConfigTree();
        onClose?.();
      }}
      enforceFocus={false}
      isCloseButtonShown={false}
      style={{ width: "80vw", height: "80vh" }}
      className="relative bg-white"
    >
      <div className={Classes.DIALOG_BODY}>
        <style>{`
          .dg-settings-tabs .bp3-tab-list {
            overflow-y: auto;
            overflow-x: hidden;
            max-height: 100%;
            /* Firefox */
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
            /* Webkit browsers */
            &::-webkit-scrollbar {
              width: 6px;
            }
            &::-webkit-scrollbar-track {
              background: transparent;
            }
            &::-webkit-scrollbar-thumb {
              background-color: rgba(0, 0, 0, 0.2);
              border-radius: 3px;
            }
          }

          /* Override bp3-tab-copy font-size when text-lg is applied */
          .bp3-tab-copy.text-lg {
            font-size: 1.125rem;
          }
        `}</style>
        <Tabs
          className="dg-settings-tabs flex h-full"
          onChange={(id) => {
            setActiveTabId(id);
            posthog.capture("Settings: Tab Opened", {
              tabId: String(id),
            });
          }}
          selectedTabId={visibleTabId}
          vertical={true}
          renderActiveTabPanelOnly={true}
        >
          <SectionHeader className="text-lg font-semibold text-neutral-dark">
            Personal Settings
          </SectionHeader>
          <Tab
            id={settingsTabIds.homePersonal}
            title="Home"
            className="overflow-y-auto"
            panel={
              <HomePersonalSettings
                onloadArgs={onloadArgs}
                personalSettings={settings.personalSettings}
              />
            }
          />
          <Tab
            id="query-settings"
            title="Queries"
            className="overflow-y-auto"
            panel={
              <QuerySettings
                extensionAPI={extensionAPI}
                personalSettings={settings.personalSettings}
              />
            }
          />
          <Tab
            id="canvas-shortcuts-personal-settings"
            title="Canvas"
            className="overflow-y-auto"
            panel={
              <CanvasShortcutSettings
                personalSettings={settings.personalSettings}
              />
            }
          />
          <Tab
            id={settingsTabIds.leftSidebarPersonal}
            hidden={!leftSidebarEnabled}
            title="Left sidebar"
            className="overflow-y-auto"
            panel={
              <LeftSidebarPersonalSections
                personalSettings={settings.personalSettings}
                expandedSectionUid={expandedSectionUid}
              />
            }
          />
          <SectionHeader className="text-lg font-semibold text-neutral-dark">
            Global Settings
          </SectionHeader>
          <Tab
            id="discourse-graph-home"
            title="Home"
            className="overflow-y-auto"
            panel={
              <DiscourseGraphHome
                globalSettings={settings.globalSettings}
                featureFlags={settings.featureFlags}
              />
            }
          />
          <Tab
            id="discourse-graph-export"
            title="Export"
            className="overflow-y-auto"
            panel={
              <DiscourseGraphExport globalSettings={settings.globalSettings} />
            }
          />
          <Tab
            id={settingsTabIds.leftSidebarGlobal}
            hidden={!leftSidebarEnabled}
            title="Left sidebar"
            className="overflow-y-auto"
            panel={
              <LeftSidebarGlobalSections
                globalSettings={settings.globalSettings}
              />
            }
          />
          <SectionHeader>Grammar</SectionHeader>
          <Tab
            id="discourse-relations"
            title="Relations"
            className="overflow-y-auto"
            panel={
              <DiscourseRelationConfigPanel
                defaultValue={DEFAULT_RELATION_VALUES}
                title="Relations"
                parentUid={grammarNode?.uid || ""}
                uid={relationsNode?.uid || ""}
              />
            }
          />
          <Tab
            id="discourse-nodes"
            title="Nodes"
            className="overflow-y-auto"
            panel={
              <DiscourseNodeConfigPanel
                title="Nodes"
                uid={nodesNode?.uid || ""}
                parentUid={grammarNode?.uid || ""}
                defaultValue={[]}
                setSelectedTabId={setActiveTabId}
                isPopup={true}
              />
            }
          />
          <SectionHeader>Nodes</SectionHeader>
          {nodes.map((n) => (
            <Tab
              key={n.type}
              id={n.type}
              title={n.text}
              className="overflow-y-auto"
              panel={<NodeConfig node={n} onloadArgs={onloadArgs} />}
            />
          ))}
          <Tabs.Expander />
          {/* Secret Admin Panel */}
          <Tab
            hidden={true}
            id={ADMIN_TAB_ID}
            title="Admin"
            className="overflow-y-auto"
            panel={<AdminPanel globalSettings={settings.globalSettings} />}
          />
        </Tabs>
      </div>
      <div className="absolute bottom-4 left-4 flex items-center gap-4">
        <Button
          icon="send-message"
          intent={Intent.PRIMARY}
          onClick={() => {
            posthog.capture("Feedback: Triggered from Settings");
            const birdeatsbug = window.birdeatsbug as FeedbackWidget;
            birdeatsbug.trigger?.();
          }}
        >
          Send Feedback
        </Button>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-2">
        {showAdminPanel && (
          <Button
            minimal={true}
            outlined={true}
            small={true}
            onClick={openAdminPanel}
          >
            Admin
          </Button>
        )}
        <span className="text-xs text-gray-500">v{versionStamp}</span>
      </div>
      {/* <Button
        icon="cross"
        minimal
        intent={Intent.NONE}
        onClick={onClose}
        className="absolute top-0 right-0"
      /> */}
    </Dialog>
  );
};

type Props = {
  onloadArgs: OnloadArgs;
  selectedTabId?: TabId;
  expandedSectionUid?: string;
};
export const render = (props: Props) =>
  renderOverlay({
    Overlay: SettingsDialog,
    props: {
      onloadArgs: props.onloadArgs,
      selectedTabId: props.selectedTabId,
      expandedSectionUid: props.expandedSectionUid,
    },
  });
