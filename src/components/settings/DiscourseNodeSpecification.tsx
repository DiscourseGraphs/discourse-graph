import React from "react";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import { Switch } from "@blueprintjs/core";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import refreshConfigTree from "../../utils/refreshConfigTree";
import getDiscourseNodes from "../../utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "../../utils/getDiscourseNodeFormatExpression";
import QueryEditor from "../QueryEditor";

const NodeSpecification = ({
  parentUid,
  node,
}: {
  parentUid: string;
  node: ReturnType<typeof getDiscourseNodes>[number];
}) => {
  const [migrated, setMigrated] = React.useState(false);
  const [enabled, setEnabled] = React.useState(
    () =>
      getSubTree({ tree: getBasicTreeByParentUid(parentUid), key: "enabled" })
        ?.uid
  );
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
            })
          )
          .then(() => setMigrated(true));
      }
    } else {
      const tree = getBasicTreeByParentUid(parentUid);
      const scratchNode = getSubTree({ tree, key: "scratch" });
      Promise.all(scratchNode.children.map((c) => deleteBlock(c.uid)));
    }
    return () => {
      refreshConfigTree();
    };
  }, [parentUid, setMigrated, enabled]);
  return (
    <div className={"roamjs-node-specification"}>
      <style>
        {`.roamjs-node-specification .bp3-button.bp3-intent-primary { display: none; }`}
      </style>
      <p>
        <Switch
          checked={!!enabled}
          className={"inline-block ml-8"}
          onChange={(e) => {
            const flag = (e.target as HTMLInputElement).checked;
            if (flag) {
              createBlock({
                parentUid,
                order: 2,
                node: { text: "enabled" },
              }).then(setEnabled);
            } else {
              deleteBlock(enabled).then(() => setEnabled(""));
            }
          }}
        />
      </p>
      <div
        className={`${enabled ? "" : "bg-gray-200 opacity-75"} overflow-auto`}
      >
        <QueryEditor
          parentUid={parentUid}
          key={Number(migrated)}
          hideCustomSwitch
        />
      </div>
    </div>
  );
};

export default NodeSpecification;
