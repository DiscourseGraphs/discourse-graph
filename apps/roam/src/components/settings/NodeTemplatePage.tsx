import React from "react";
import { getSubTree } from "roamjs-components/util";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import DualWriteBlocksPanel from "./components/EphemeralBlocksPanel";
import { TEMPLATE_SETTING_KEYS } from "~/components/settings/utils/settingKeys";
import { ROAM_DOCS, withDocsLink } from "./utils/docs";

const NodeTemplatePage = ({ node }: { node: DiscourseNode }): JSX.Element => {
  const templateUid = getSubTree({ parentUid: node.type, key: "Template" }).uid;
  return (
    <div className="flex flex-col gap-4 p-1">
      <DualWriteBlocksPanel
        nodeType={node.type}
        title="Template"
        description={withDocsLink(
          `The template that auto fills ${node.text} page when generated.`,
          ROAM_DOCS.creatingNodes,
        )}
        settingKeys={TEMPLATE_SETTING_KEYS}
        uid={templateUid}
        defaultValue={node.template}
      />
    </div>
  );
};

export default NodeTemplatePage;
