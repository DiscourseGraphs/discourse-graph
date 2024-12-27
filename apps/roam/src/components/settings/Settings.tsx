import React, { useState } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Classes, Dialog, Tabs, Tab, Button, TabId } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import DiscourseRelationConfigPanel from "./DiscourseRelationConfigPanel";
import DEFAULT_RELATION_VALUES from "~/data/defaultDiscourseRelations";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import DiscourseGraphHome from "./GeneralSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/settings/configPages";
import DiscourseGraphExport from "./ExportSettings";
import QuerySettings from "./QuerySettings";
import DiscourseNodeConfigPanel from "./DiscourseNodeConfigPanel";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import NodeConfig from "./NodeConfig";
import sendErrorEmail from "~/utils/sendErrorEmail";

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

const openPage = (title: string) => {
  window.roamAlphaAPI.ui.mainWindow.openPage({
    page: {
      title,
    },
  });
};

export const SettingsPanel = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  return (
    <div className="m-4">
      <Button
        onClick={() => {
          render({
            extensionAPI,
          });
        }}
      >
        Open Settings
      </Button>
    </div>
  );
};

export const SettingsDialog = ({
  extensionAPI,
  isOpen,
  onClose,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
  isOpen?: boolean;
  onClose?: () => void;
}) => {
  const settings = getFormattedConfigTree();
  const nodes = getDiscourseNodes().filter(excludeDefaultNodes);
  const [selectedTabId, setSelectedTabId] = useState<TabId>(
    "discourse-graph-home",
  );
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
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
          className="h-full"
        >
          <Tab
            id="discourse-graph-home"
            title="Home"
            className="overflow-y-auto"
            panel={<DiscourseGraphHome extensionAPI={extensionAPI} />}
          />
          <Tab
            id="discourse-graph-export"
            title="Export"
            className="overflow-y-auto"
            panel={<DiscourseGraphExport />}
          />
          <Tab
            id="query-settings"
            title="Queries"
            className="overflow-y-auto"
            panel={<QuerySettings extensionAPI={extensionAPI} />}
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
              panel={<NodeConfig node={n} />}
            />
          ))}
          <Tabs.Expander />

          <Button
            minimal
            outlined
            onClick={() => {
              openPage(DISCOURSE_CONFIG_PAGE_TITLE);
              onClose?.();
            }}
          >
            Discourse Graph Config
          </Button>

          {/* TEMP LIVE EMAIL TEST */}
          <Tab
            id="dev"
            title="Dev"
            className="overflow-y-auto"
            panel={
              <div>
                <Button
                  onClick={() => {
                    console.log("sending error email");
                    sendErrorEmail({
                      error: new Error("test"),
                      type: "Test",
                    });
                  }}
                >
                  Send Error Email
                </Button>
              </div>
            }
          />
        </Tabs>
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
  extensionAPI: OnloadArgs["extensionAPI"];
};
export const render = (props: Props) =>
  renderOverlay({
    Overlay: SettingsDialog,
    props: {
      extensionAPI: props.extensionAPI,
    },
  });
