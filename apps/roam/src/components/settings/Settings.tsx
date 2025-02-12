import React, { useEffect, useState } from "react";
import { OnloadArgs } from "roamjs-components/types";
import { Classes, Dialog, Tabs, Tab, Button, TabId } from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";
import DiscourseRelationConfigPanel from "./DiscourseRelationConfigPanel";
import DEFAULT_RELATION_VALUES from "~/data/defaultDiscourseRelations";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";
import DiscourseGraphHome from "./GeneralSettings";
import { DISCOURSE_CONFIG_PAGE_TITLE } from "~/utils/renderNodeConfigPage";
import DiscourseGraphExport from "./ExportSettings";
import QuerySettings from "./QuerySettings";
import DiscourseNodeConfigPanel from "./DiscourseNodeConfigPanel";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import NodeConfig from "./NodeConfig";
import sendErrorEmail from "~/utils/sendErrorEmail";
import { NodeMenuTriggerComponent } from "../DiscourseNodeMenu";
import { AsyncQuerySettings } from "./AsyncQuerySettings";

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
    "discourse-graph-home",
  );

  // Secret Dev Panel
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
        >
          <div className="mb-6 text-lg font-semibold text-neutral-dark">
            Global Settings
          </div>

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
              panel={<NodeConfig node={n} onloadArgs={onloadArgs} />}
            />
          ))}

          <Tabs.Expander />

          <div className="mb-2 mt-6 text-lg font-semibold text-neutral-dark">
            Personal Settings
          </div>

          <Tab
            id="discourse-node-menu-trigger"
            title="Personal Node Menu Trigger"
            panel={NodeMenuTriggerComponent(extensionAPI)}
          />
          <Tab
            id="backend-query"
            title="Use Backend Query (Beta)"
            panel={<AsyncQuerySettings />}
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
  onloadArgs: OnloadArgs;
};
export const render = (props: Props) =>
  renderOverlay({
    Overlay: SettingsDialog,
    props: {
      onloadArgs: props.onloadArgs,
    },
  });
