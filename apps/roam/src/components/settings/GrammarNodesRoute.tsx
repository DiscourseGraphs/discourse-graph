import React, { useEffect } from "react";
import { Button } from "@blueprintjs/core";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { nodeConfigSegmentIds } from "./utils/settingsNavigation";
import { useSettingsNav } from "./navigation/SettingsNavContext";
import SettingsPageHeader from "./navigation/SettingsPageHeader";
import DiscourseNodeConfigPanel from "./DiscourseNodeConfigPanel";
import NodeConfig from "./NodeConfig";
import NodeIndexPage from "./NodeIndexPage";
import NodeTemplatePage from "./NodeTemplatePage";
import { isSyncEnabled } from "./utils/accessors";
import {
  CollapsedSections,
  areAllSectionsCollapsed,
  getNodeConfigSections,
  toggleAllSections,
  toggleSection,
} from "./utils/nodeConfigSections";

const NODES_ANCESTOR_LABELS = ["Grammar"] as const;

const SUB_PAGE_LABELS: Record<string, string | undefined> = {
  [nodeConfigSegmentIds.index]: "Index",
  [nodeConfigSegmentIds.template]: "Template",
};

const GrammarNodesRoute = ({
  onloadArgs,
  collapsedSections,
  setCollapsedSections,
}: {
  onloadArgs: OnloadArgs;
  collapsedSections: CollapsedSections;
  setCollapsedSections: React.Dispatch<React.SetStateAction<CollapsedSections>>;
}): JSX.Element => {
  const { segments, goToDepth } = useSettingsNav();
  const nodes = getDiscourseNodes().filter(excludeDefaultNodes);

  const [nodeTypeUid, subPage] = segments;
  const node = nodeTypeUid
    ? nodes.find((n) => n.type === nodeTypeUid)
    : undefined;

  // A deleted node type or stale deep link resolves to nothing; return to the list.
  const isStalePath = Boolean(nodeTypeUid) && !node;
  useEffect(() => {
    if (isStalePath) goToDepth(0);
  }, [isStalePath, goToDepth]);

  const resolveLabel = (segment: string, segmentIndex: number): string =>
    segmentIndex === 0
      ? (nodes.find((n) => n.type === segment)?.text ?? segment)
      : (SUB_PAGE_LABELS[segment] ?? segment);

  const sections =
    node && !subPage
      ? getNodeConfigSections({ isSyncEnabled: isSyncEnabled() })
      : null;
  const allCollapsed =
    !!sections && areAllSectionsCollapsed(collapsedSections, sections);

  return (
    <div className="flex h-full flex-col">
      <SettingsPageHeader
        ancestorLabels={NODES_ANCESTOR_LABELS}
        rootLabel="Nodes"
        resolveLabel={resolveLabel}
        actions={
          sections && (
            <Button
              minimal
              small
              icon={allCollapsed ? "expand-all" : "collapse-all"}
              text={allCollapsed ? "Expand all" : "Collapse all"}
              onClick={() =>
                setCollapsedSections((prev) =>
                  toggleAllSections(prev, sections),
                )
              }
            />
          )
        }
      />
      {/* `-mx-1 px-1` widens the scroll box so the search flash is not clipped; content stays put. */}
      <div className="-mx-1 min-h-0 flex-auto overflow-y-auto px-1">
        {!node ? (
          <div className="p-1">
            <DiscourseNodeConfigPanel />
          </div>
        ) : subPage === nodeConfigSegmentIds.index ? (
          <NodeIndexPage node={node} onloadArgs={onloadArgs} />
        ) : subPage === nodeConfigSegmentIds.template ? (
          <NodeTemplatePage node={node} />
        ) : (
          <NodeConfig
            node={node}
            collapsedSections={collapsedSections}
            onToggleSection={(section) =>
              setCollapsedSections((prev) => toggleSection(prev, section))
            }
          />
        )}
      </div>
    </div>
  );
};

export default GrammarNodesRoute;
