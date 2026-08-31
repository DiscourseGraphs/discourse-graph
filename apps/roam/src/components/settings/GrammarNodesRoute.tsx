import React, { useEffect } from "react";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { formatHexColor } from "./DiscourseNodeCanvasSettings";
import { nodeConfigSegmentIds } from "./utils/settingsNavigation";
import { useSettingsNav } from "./navigation/SettingsNavContext";
import SettingsPageHeader from "./navigation/SettingsPageHeader";
import DiscourseNodeConfigPanel from "./DiscourseNodeConfigPanel";
import NodeConfig from "./NodeConfig";
import NodeIndexPage from "./NodeIndexPage";
import NodeTemplatePage from "./NodeTemplatePage";

const NODES_ANCESTOR_LABELS = ["Grammar"] as const;

const SUB_PAGE_LABELS: Record<string, string | undefined> = {
  [nodeConfigSegmentIds.index]: "Index",
  [nodeConfigSegmentIds.template]: "Template",
};

const GrammarNodesRoute = ({
  onloadArgs,
}: {
  onloadArgs: OnloadArgs;
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

  // Sub-pages fall through to the stylesheet's default dot colour.
  const dotColor = subPage
    ? undefined
    : formatHexColor(node?.canvasSettings?.color ?? "") || undefined;

  return (
    <div className="dg-settings-route">
      <SettingsPageHeader
        ancestorLabels={NODES_ANCESTOR_LABELS}
        rootLabel="Nodes"
        resolveLabel={resolveLabel}
        dotColor={dotColor}
      />
      <div className="dg-settings-route__body">
        {!node ? (
          <DiscourseNodeConfigPanel />
        ) : subPage === nodeConfigSegmentIds.index ? (
          <NodeIndexPage node={node} onloadArgs={onloadArgs} />
        ) : subPage === nodeConfigSegmentIds.template ? (
          <NodeTemplatePage node={node} />
        ) : (
          <NodeConfig node={node} />
        )}
      </div>
    </div>
  );
};

export default GrammarNodesRoute;
