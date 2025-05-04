import React, { useState, useEffect, useMemo } from "react";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import SelectPanel from "roamjs-components/components/ConfigPanels/SelectPanel";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import { getSubTree, setInputSetting } from "roamjs-components/util";
import Description from "roamjs-components/components/Description";
import {
  Label,
  Tabs,
  Tab,
  TabId,
  Checkbox,
  Icon,
  Tooltip,
  Button,
} from "@blueprintjs/core";
import DiscourseNodeSpecification from "./DiscourseNodeSpecification";
import DiscourseNodeAttributes from "./DiscourseNodeAttributes";
import DiscourseNodeCanvasSettings from "./DiscourseNodeCanvasSettings";
import DiscourseNodeIndex from "./DiscourseNodeIndex";
import { OnloadArgs } from "roamjs-components/types";
import CommentsQuery from "~/components/GitHubSyncCommentsQuery";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";

const NodeConfig = ({
  node,
  onloadArgs,
  setMainTab,
}: {
  node: DiscourseNode;
  onloadArgs: OnloadArgs;
  setMainTab: (tabId: TabId) => void;
}) => {
  const getUid = (key: string) =>
    getSubTree({
      parentUid: node.type,
      key: key,
    }).uid;
  const formatUid = getUid("Format");
  const descriptionUid = getUid("Description");
  const shortcutUid = getUid("Shortcut");
  const templateUid = getUid("Template");
  const overlayUid = getUid("Overlay");
  const canvasUid = getUid("Canvas");
  const graphOverviewUid = getUid("Graph Overview");
  const githubSyncUid = getUid("GitHub Sync");

  const [githubCommentsFormatUid, setGithubCommentsFormatUid] =
    useState<string>("");

  // TEMP FIX: This is a workaround to ensure the github comments format uid is set after the github sync node is created
  useEffect(() => {
    const timeout = setTimeout(() => {
      const commentsUid = getSubTree({
        parentUid: githubSyncUid,
        key: "Comments Block",
      }).uid;
      setGithubCommentsFormatUid(commentsUid);
    }, 250);

    return () => clearTimeout(timeout);
  }, [node.type]);

  const attributeNode = getSubTree({
    parentUid: node.type,
    key: "Attributes",
  });

  const [selectedTabId, setSelectedTabId] = useState<TabId>("main");
  const [isGithubSyncEnabled, setIsGithubSyncEnabled] = useState<boolean>(
    node.githubSync?.enabled || false,
  );

  const globalSettings = useMemo(() => getFormattedConfigTree(), []);
  const globalGithubSyncEnabled = globalSettings.githubSync.value;
  return (
    <>
      <Tabs
        onChange={(id) => setSelectedTabId(id)}
        selectedTabId={selectedTabId}
        renderActiveTabPanelOnly={true}
        className="discourse-node-tabs overflow-x-auto"
      >
        <Tab
          id="main"
          title="Main"
          panel={
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-1">
              <TextPanel
                title="Description"
                description={`Describing what the ${node.text} node represents in your graph.`}
                order={0}
                parentUid={node.type}
                uid={descriptionUid}
                defaultValue={node.description}
              />
              <TextPanel
                title="Shortcut"
                description={`The trigger to quickly create a ${node.text} page from the node menu.`}
                order={0}
                parentUid={node.type}
                uid={shortcutUid}
                defaultValue={node.shortcut}
              />
            </div>
          }
        />
        <Tab
          id="index"
          title="Index"
          panel={
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-1">
              <DiscourseNodeIndex
                node={node}
                parentUid={node.type}
                onloadArgs={onloadArgs}
              />
            </div>
          }
        />
        <Tab
          id="format"
          title="Format"
          panel={
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-1">
              <TextPanel
                title="Format"
                description={`DEPRECATED - Use specification instead. The format ${node.text} pages should have.`}
                order={0}
                parentUid={node.type}
                uid={formatUid}
                defaultValue={node.format}
              />
              <Label>
                Specification
                <Description
                  description={
                    "The conditions specified to identify a ${nodeText} node."
                  }
                />
                <DiscourseNodeSpecification node={node} parentUid={node.type} />
              </Label>
            </div>
          }
        />
        <Tab
          id="template"
          title="Template"
          panel={
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-1">
              <BlocksPanel
                title="Template"
                description={`The template that auto fills ${node.text} page when generated.`}
                order={0}
                parentUid={node.type}
                uid={templateUid}
                defaultValue={node.template}
              />
            </div>
          }
        />
        <Tab
          id="attributes"
          title="Attributes"
          panel={
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-1">
              <DiscourseNodeAttributes uid={attributeNode.uid} />
              <SelectPanel
                title="Overlay"
                description="Select which attribute is used for the Discourse Overlay"
                order={0}
                parentUid={node.type}
                uid={overlayUid}
                options={{
                  items: () => attributeNode.children.map((c) => c.text),
                }}
              />
            </div>
          }
        />
        <Tab
          id="canvas"
          title="Canvas"
          panel={
            <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto p-1">
              <DiscourseNodeCanvasSettings uid={canvasUid} />
              <FlagPanel
                title="Graph Overview"
                description="Whether to color the node in the graph overview based on canvas color.  This is based on the node's plain title as described by a \`has title\` condition in its specification."
                order={0}
                parentUid={node.type}
                uid={graphOverviewUid}
                value={node.graphOverview}
              />
            </div>
          }
        />
        <Tab
          id="github"
          title="GitHub"
          panel={
            <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto p-1">
              <div className="mb-4 rounded bg-gray-50 p-4">
                <p className="mb-2 text-sm text-gray-600">
                  GitHub integration allows you to sync {node.text} pages with
                  GitHub Issues. When enabled, you can:
                </p>
                <ul className="list-disc pl-5 text-sm text-gray-600">
                  <li>Send pages to GitHub as issues</li>
                  <li>Import and sync comments from GitHub</li>
                  <li>Configure where comments appear in the page</li>
                </ul>
              </div>

              {!globalGithubSyncEnabled && (
                <div className="flex flex-col gap-2">
                  <p>GitHub Sync is not enabled globally.</p>
                  <Button
                    intent="primary"
                    className="max-w-xs"
                    text="Navigate to global settings"
                    onClick={() => setMainTab("discourse-graph-home")}
                  />
                </div>
              )}

              {globalGithubSyncEnabled && (
                <>
                  <Checkbox
                    style={{ width: 240, lineHeight: "normal" }}
                    checked={isGithubSyncEnabled}
                    onChange={(e) => {
                      const target = e.target as HTMLInputElement;
                      setIsGithubSyncEnabled(target.checked);
                      setInputSetting({
                        blockUid: githubSyncUid,
                        key: "Enabled",
                        value: target.checked ? "true" : "false",
                      });
                    }}
                  >
                    GitHub Sync Enabled
                    <Tooltip
                      content={`When enabled, ${node.text} pages can be synced with GitHub Issues.`}
                    >
                      <Icon
                        icon={"info-sign"}
                        iconSize={12}
                        className={"ml-2 align-middle opacity-80"}
                      />
                    </Tooltip>
                  </Checkbox>

                  {isGithubSyncEnabled && (
                    <>
                      <Label>
                        Comments Configuration
                        <Description description="Define where GitHub Issue comments should appear on this node type. This query will run when comments are imported." />
                      </Label>
                      <CommentsQuery
                        parentUid={githubCommentsFormatUid}
                        onloadArgs={onloadArgs}
                      />
                    </>
                  )}
                </>
              )}
            </div>
          }
        />
      </Tabs>
    </>
  );
};

export default NodeConfig;
