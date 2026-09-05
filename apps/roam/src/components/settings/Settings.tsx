import React, {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
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
import QuerySettings from "./QuerySettings";
import AdminPanel from "./AdminPanel";
import PreferencesGeneral from "./PreferencesGeneral";
import PreferencesStyling from "./PreferencesStyling";
import LeftSidebarSettings from "./LeftSidebarSettings";
import DiscourseContextSettings from "./DiscourseContextSettings";
import CanvasSettings from "./CanvasSettings";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { FeedbackWidget } from "~/components/BirdEatsBugs";
import { getVersionWithDate } from "~/utils/getVersion";
import posthog from "posthog-js";
import { bulkReadSettings } from "./utils/accessors";
import { onSettingChange, settingKeys } from "./utils/settingsEmitter";
import { SETTINGS_TAB_IDS, SETTINGS_TAB_META } from "./utils/settingsTabs";
import {
  resolveInitialSettingsPath,
  settingsNavReducer,
  tabIdOf,
} from "./utils/settingsNavigation";
import { SettingsNavProvider } from "./navigation/SettingsNavContext";
import GrammarNodesRoute from "./GrammarNodesRoute";

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <div className="bp3-tab-copy mt-4 cursor-default select-none text-lg font-semibold text-neutral-dark">
    {children}
  </div>
);

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
  const [path, dispatch] = useReducer(
    settingsNavReducer,
    selectedTabId,
    resolveInitialSettingsPath,
  );
  const activeTabId = tabIdOf(path);
  const selectTab = useCallback(
    (tabId: string) => dispatch({ type: "select-tab", tabId }),
    [],
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
    selectTab(SETTINGS_TAB_IDS.admin);
    posthog.capture("Settings: Admin Panel Opened from Footer");
  };

  const initialTabId = useRef(activeTabId).current;
  useEffect(() => {
    posthog.capture("Settings: Dialog Opened", { initialTabId });
  }, [initialTabId]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "A") {
        e.stopPropagation();
        e.preventDefault();
        setShowAdminPanel(true);
        selectTab(SETTINGS_TAB_IDS.admin);
        posthog.capture("Settings: Admin Panel Opened via Shortcut");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [selectTab]);
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
            selectTab(String(id));
            posthog.capture("Settings: Tab Opened", {
              tabId: String(id),
            });
          }}
          selectedTabId={activeTabId}
          vertical={true}
          renderActiveTabPanelOnly={true}
        >
          <SectionHeader>Preferences</SectionHeader>
          <Tab
            id={SETTINGS_TAB_IDS.preferencesGeneral}
            title={SETTINGS_TAB_META[SETTINGS_TAB_IDS.preferencesGeneral].label}
            className="overflow-y-auto"
            panel={
              <PreferencesGeneral
                onloadArgs={onloadArgs}
                globalSettings={settings.globalSettings}
                personalSettings={settings.personalSettings}
              />
            }
          />
          <Tab
            id={SETTINGS_TAB_IDS.preferencesStyling}
            title={SETTINGS_TAB_META[SETTINGS_TAB_IDS.preferencesStyling].label}
            className="overflow-y-auto"
            panel={
              <PreferencesStyling
                personalSettings={settings.personalSettings}
              />
            }
          />
          <SectionHeader>Features</SectionHeader>
          <Tab
            id={SETTINGS_TAB_IDS.featuresDiscourseContext}
            title={
              SETTINGS_TAB_META[SETTINGS_TAB_IDS.featuresDiscourseContext].label
            }
            className="overflow-y-auto"
            panel={
              <DiscourseContextSettings
                onloadArgs={onloadArgs}
                personalSettings={settings.personalSettings}
              />
            }
          />
          <Tab
            id={SETTINGS_TAB_IDS.featuresCanvas}
            title={SETTINGS_TAB_META[SETTINGS_TAB_IDS.featuresCanvas].label}
            className="overflow-y-auto"
            panel={
              <CanvasSettings
                onloadArgs={onloadArgs}
                globalSettings={settings.globalSettings}
                personalSettings={settings.personalSettings}
              />
            }
          />
          <Tab
            id={SETTINGS_TAB_IDS.featuresLeftSidebar}
            title={
              SETTINGS_TAB_META[SETTINGS_TAB_IDS.featuresLeftSidebar].label
            }
            className="overflow-y-auto"
            panel={
              <LeftSidebarSettings
                enabled={leftSidebarEnabled}
                globalSettings={settings.globalSettings}
                personalSettings={settings.personalSettings}
                featureFlags={settings.featureFlags}
                expandedSectionUid={expandedSectionUid}
              />
            }
          />
          <SectionHeader>Grammar</SectionHeader>
          <Tab
            id={SETTINGS_TAB_IDS.grammarNodes}
            title={SETTINGS_TAB_META[SETTINGS_TAB_IDS.grammarNodes].label}
            panel={
              <SettingsNavProvider path={path} dispatch={dispatch}>
                <GrammarNodesRoute onloadArgs={onloadArgs} />
              </SettingsNavProvider>
            }
          />
          <Tab
            id={SETTINGS_TAB_IDS.grammarRelations}
            title={SETTINGS_TAB_META[SETTINGS_TAB_IDS.grammarRelations].label}
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
          <SectionHeader>Advanced</SectionHeader>
          <Tab
            id={SETTINGS_TAB_IDS.advancedQueries}
            title={SETTINGS_TAB_META[SETTINGS_TAB_IDS.advancedQueries].label}
            className="overflow-y-auto"
            panel={
              <QuerySettings
                extensionAPI={extensionAPI}
                personalSettings={settings.personalSettings}
              />
            }
          />
          <Tabs.Expander />
          {/* Secret Admin Panel */}
          <Tab
            hidden={true}
            id={SETTINGS_TAB_IDS.admin}
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
