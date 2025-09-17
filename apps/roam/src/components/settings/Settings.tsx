import React, { useEffect, useState } from "react";
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
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import DiscourseGraphHome from "./GeneralSettings";
import DiscourseGraphExport from "./ExportSettings";
import QuerySettings from "./QuerySettings";
import DiscourseNodeConfigPanel from "./DiscourseNodeConfigPanel";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import NodeConfig from "./NodeConfig";
import sendErrorEmail from "~/utils/sendErrorEmail";
import HomePersonalSettings from "./HomePersonalSettings";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { FeedbackWidget } from "~/components/BirdEatsBugs";
import { getVersionWithDate } from "~/utils/getVersion";

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
}: {
  onloadArgs: OnloadArgs;
  isOpen?: boolean;
  onClose?: () => void;
}) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const settings = getFormattedConfigTree();
  const nodes = getDiscourseNodes().filter(excludeDefaultNodes);
  const [selectedTabId, setSelectedTabId] = useState<TabId>(
    "discourse-graph-home-personal",
  );

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.stopPropagation();
        e.preventDefault();
        setSelectedTabId("secret-dev-panel");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);
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
          onChange={(id) => setSelectedTabId(id)}
          selectedTabId={selectedTabId}
          vertical={true}
          renderActiveTabPanelOnly={true}
        >
          <SectionHeader className="text-lg font-semibold text-neutral-dark">
            Personal Settings
          </SectionHeader>
          <Tab
            id="discourse-graph-home-personal"
            title="Home"
            className="overflow-y-auto"
            panel={<HomePersonalSettings onloadArgs={onloadArgs} />}
          />
          <Tab
            id="query-settings"
            title="Queries"
            className="overflow-y-auto"
            panel={<QuerySettings extensionAPI={extensionAPI} />}
          />
          <SectionHeader className="text-lg font-semibold text-neutral-dark">
            Global Settings
          </SectionHeader>
          <Tab
            id="discourse-graph-home"
            title="Home"
            className="overflow-y-auto"
            panel={<DiscourseGraphHome />}
          />
          <Tab
            id="discourse-graph-export"
            title="Export"
            className="overflow-y-auto"
            panel={<DiscourseGraphExport />}
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
                parentUid={settings.grammarUid}
                uid={settings.relationsUid}
              />
            }
          />
          <Tab
            id="discourse-nodes"
            title="Nodes"
            className="rm-settings__tab overflow-y-auto"
            panel={
              <DiscourseNodeConfigPanel
                title="Nodes"
                uid={settings.nodesUid}
                parentUid={settings.grammarUid}
                defaultValue={[]}
                setSelectedTabId={setSelectedTabId}
                isPopup={true}
              />
            }
          />
          <SectionHeader>Nodes</SectionHeader>
          {nodes.map((n) => (
            <Tab
              id={n.type}
              title={n.text}
              className="overflow-y-auto"
              panel={<NodeConfig node={n} onloadArgs={onloadArgs} />}
            />
          ))}
          <Tabs.Expander />
          {/* Secret Dev Panel */}
          <Tab
            hidden={true}
            id="secret-dev-panel"
            title="Secret Dev Panel"
            className="overflow-y-auto"
            panel={
              <div className="flex gap-4 p-4">
                <Button
                  onClick={() => {
                    console.log("NODE_ENV:", process.env.NODE_ENV);
                  }}
                >
                  Log Node Env
                </Button>
                <Button
                  onClick={() => {
                    console.log("sending error email");
                    sendErrorEmail({
                      error: new Error("test"),
                      type: "Test",
                    });
                  }}
                >
                  sendErrorEmail()
                </Button>
              </div>
            }
          />
        </Tabs>
      </div>
      <div className="absolute bottom-4 left-4 flex items-center gap-4">
        <Button
          icon="send-message"
          intent={Intent.PRIMARY}
          onClick={() => {
            const birdeatsbug = window.birdeatsbug as FeedbackWidget;
            birdeatsbug.trigger?.();
          }}
        >
          Send Feedback
        </Button>
      </div>
      <div className="absolute bottom-4 right-4">
        <span className="text-xs text-gray-500">
          v{getVersionWithDate().version}-{getVersionWithDate().buildDate}
        </span>
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
};
export const render = (props: Props) =>
  renderOverlay({
    Overlay: SettingsDialog,
    props: {
      onloadArgs: props.onloadArgs,
    },
  });
