import React, { useEffect } from "react";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { formatHexColor } from "./DiscourseNodeCanvasSettings";
import { useSettingsNav } from "./navigation/SettingsNavContext";
import SettingsPageHeader from "./navigation/SettingsPageHeader";
import DiscourseNodeConfigPanel from "./DiscourseNodeConfigPanel";
import NodeConfig from "./NodeConfig";

const NODES_ANCESTOR_LABELS = ["Grammar"] as const;

const GrammarNodesRoute = ({
  onloadArgs,
}: {
  onloadArgs: OnloadArgs;
}): JSX.Element => {
  const { segments, goToDepth } = useSettingsNav();
  const nodes = getDiscourseNodes().filter(excludeDefaultNodes);

  const [nodeTypeUid] = segments;
  const node = nodeTypeUid
    ? nodes.find((n) => n.type === nodeTypeUid)
    : undefined;

  // A deleted node type or stale deep link resolves to nothing; return to the list.
  const isStalePath = Boolean(nodeTypeUid) && !node;
  useEffect(() => {
    if (isStalePath) goToDepth(0);
  }, [isStalePath, goToDepth]);

  const resolveLabel = (segment: string): string =>
    nodes.find((n) => n.type === segment)?.text ?? segment;

  return (
    <div className="dg-settings-route">
      <SettingsPageHeader
        ancestorLabels={NODES_ANCESTOR_LABELS}
        rootLabel="Nodes"
        resolveLabel={resolveLabel}
        dotColor={
          formatHexColor(node?.canvasSettings?.color ?? "") || undefined
        }
      />
      <div className="dg-settings-route__body">
        {node ? (
          <NodeConfig node={node} onloadArgs={onloadArgs} />
        ) : (
          <div className="p-1">
            <DiscourseNodeConfigPanel />
          </div>
        )}
      </div>
    </div>
  );
};

export default GrammarNodesRoute;
