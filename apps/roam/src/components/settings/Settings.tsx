import React, { useEffect, useState } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Classes, Dialog, Tabs, Tab, Button, TabId } from "@blueprintjs/core";
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

type SectionHeaderProps = {
  children: React.ReactNode;
};
const SectionHeader = ({ children }: SectionHeaderProps) => {
  return (
    <div className="bp3-tab-copy mt-4 cursor-default select-none font-bold">
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
      isCloseButtonShown={false}
      style={{ width: "80vw", height: "80vh" }}
      className="relative bg-white"
    >
      <div className={Classes.DIALOG_BODY}>
        <Tabs
          onChange={(id) => setSelectedTabId(id)}
          selectedTabId={selectedTabId}
          vertical={true}
          renderActiveTabPanelOnly={true}
        >
          <div className="mb-2 text-lg font-semibold text-neutral-dark">
            Personal Settings
          </div>
          <Tab
            id="discourse-graph-home-personal"
            title="Home"
            className="overflow-y-auto"
            panel={<HomePersonalSettings onloadArgs={onloadArgs} />}
          />
          <Tab
            id="query-settings"
            title="Queries"
            className="mb-8 overflow-y-auto"
            panel={<QuerySettings extensionAPI={extensionAPI} />}
          />
          <div className="text-lg font-semibold text-neutral-dark">
            Global Settings
          </div>
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
            className="overflow-y-auto"
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
      <Button
        style={{ backgroundColor: "#1976d2" }}
        onClick={() => {
          const birdeatsbug = window.birdeatsbug as FeedbackWidget;
          birdeatsbug.trigger?.();
        }}
        className="absolute bottom-4 right-4"
        icon={
          <span
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='256' height='264' viewBox='0 0 256 264' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M156.705 252.012C140.72 267.995 114.803 267.995 98.8183 252.012L11.9887 165.182C-3.99622 149.197 -3.99622 123.28 11.9886 107.296L55.4035 63.8807C63.3959 55.8881 76.3541 55.8881 84.3467 63.8807C92.3391 71.8731 92.3391 84.8313 84.3467 92.8239L69.8751 107.296C53.8901 123.28 53.8901 149.197 69.8751 165.182L113.29 208.596C121.282 216.589 134.241 216.589 142.233 208.596C150.225 200.604 150.225 187.646 142.233 179.653L127.761 165.182C111.777 149.197 111.777 123.28 127.761 107.296C143.746 91.3105 143.746 65.3939 127.761 49.4091L113.29 34.9375C105.297 26.9452 105.297 13.9868 113.29 5.99432C121.282 -1.99811 134.241 -1.99811 142.233 5.99434L243.533 107.296C259.519 123.28 259.519 149.197 243.533 165.182L156.705 252.012ZM200.119 121.767C192.127 113.775 179.168 113.775 171.176 121.767C163.184 129.76 163.184 142.718 171.176 150.71C179.168 158.703 192.127 158.703 200.119 150.71C208.112 142.718 208.112 129.76 200.119 121.767Z' fill='%23FFFFFF'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat",
              backgroundSize: "contain",
              display: "inline-block",
              width: "20px",
              height: "20px",
            }}
          />
        }
      >
        Send Feedback
      </Button>
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
