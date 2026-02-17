import React from "react";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import refreshConfigTree from "~/utils/refreshConfigTree";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import QueryEditor from "~/components/QueryEditor";
import internalError from "~/utils/internalError";
import { setDiscourseNodeSetting } from "~/components/settings/utils/accessors";
import { DiscourseNodeFlagPanel } from "~/components/settings/components/BlockPropSettingPanels";

const NodeSpecification = ({
  parentUid,
  node,
  parentSetEnabled,
}: {
  parentUid: string;
  node: ReturnType<typeof getDiscourseNodes>[number];
  parentSetEnabled?: (enabled: boolean) => void;
}) => {
  const [migrated, setMigrated] = React.useState(false);
  const enabledBlockUid = React.useMemo(
    () =>
      getSubTree({ tree: getBasicTreeByParentUid(parentUid), key: "enabled" })
        ?.uid,
    [parentUid],
  );
  const [enabled, setEnabled] = React.useState(!!enabledBlockUid);

  React.useEffect(() => {
    if (enabled) {
      const scratchNode = getSubTree({ parentUid, key: "scratch" });
      if (
        !scratchNode.children.length ||
        !getSubTree({ tree: scratchNode.children, key: "conditions" }).children
          .length
      ) {
        const conditionsUid = getSubTree({
          parentUid: scratchNode.uid,
          key: "conditions",
        }).uid;
        const returnUid = getSubTree({
          parentUid: scratchNode.uid,
          key: "return",
        }).uid;
        createBlock({
          parentUid: returnUid,
          node: {
            text: node.text,
          },
        })
          .then(() =>
            createBlock({
              parentUid: conditionsUid,
              node: {
                text: "clause",
                children: [
                  { text: "source", children: [{ text: node.text }] },
                  { text: "relation", children: [{ text: "has title" }] },
                  {
                    text: "target",
                    children: [
                      {
                        text: `/${
                          getDiscourseNodeFormatExpression(node.format).source
                        }/`,
                      },
                    ],
                  },
                ],
              },
            }),
          )
          .then(() => {
            setDiscourseNodeSetting(node.type, ["specification", "query"], {
              conditions: [
                {
                  type: "clause" as const,
                  source: node.text,
                  relation: "has title",
                  target: `/${getDiscourseNodeFormatExpression(node.format).source}/`,
                },
              ],
              selections: [],
              custom: "",
              returnNode: node.text,
            });
            setMigrated(true);
          })
          .catch((error) => {
            internalError({ error });
          });
      }
    } else {
      const tree = getBasicTreeByParentUid(parentUid);
      const scratchNode = getSubTree({ tree, key: "scratch" });
      Promise.all(scratchNode.children.map((c) => deleteBlock(c.uid)))
        .then(() => {
          setDiscourseNodeSetting(node.type, ["specification", "query"], {
            conditions: [],
            selections: [],
            custom: "",
            returnNode: "",
          });
        })
        .catch((error) => {
          internalError({ error });
        });
    }
    return () => {
      refreshConfigTree();
    };
  }, [parentUid, setMigrated, enabled, node.format, node.text]);
  return (
    <div className={"roamjs-node-specification"}>
      <style>
        {`.roamjs-node-specification .bp3-button.bp3-intent-primary { display: none; }
.roamjs-node-specification .bp3-checkbox { visibility: hidden; }
.roamjs-node-specification .bp3-checkbox .bp3-control-indicator { visibility: visible; }`}
      </style>
      <DiscourseNodeFlagPanel
        nodeType={node.type}
        title="enabled"
        description=""
        settingKeys={["specification", "enabled"]}
        initialValue={enabled}
        parentUid={parentUid}
        uid={enabledBlockUid}
        order={2}
        onChange={(checked) => {
          setEnabled(checked);
          parentSetEnabled?.(checked);
        }}
      />
      <div
        className={`${enabled ? "" : "bg-gray-200 opacity-75"} overflow-auto`}
      >
        <QueryEditor
          parentUid={parentUid}
          key={Number(migrated)}
          hideCustomSwitch
          discourseNodeType={node.type}
          settingKey="specification"
          returnNode={node.text}
        />
      </div>
    </div>
  );
};

export default NodeSpecification;
