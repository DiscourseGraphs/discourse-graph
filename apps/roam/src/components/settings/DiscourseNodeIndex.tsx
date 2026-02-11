import React, { useEffect } from "react";
import { Spinner } from "@blueprintjs/core";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import type { OnloadArgs } from "roamjs-components/types/native";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import QueryBuilder from "~/components/QueryBuilder";
import parseQuery, { DEFAULT_RETURN_NODE } from "~/utils/parseQuery";
import createBlock from "roamjs-components/writes/createBlock";
import { setDiscourseNodeSetting } from "~/components/settings/utils/accessors";

const NodeIndex = ({
  parentUid,
  node,
  onloadArgs,
}: {
  parentUid: string;
  node: DiscourseNode;
  onloadArgs: OnloadArgs;
}) => {
  const initialQueryArgs = React.useMemo(
    () => parseQuery(parentUid),
    [parentUid],
  );
  const [showQuery, setShowQuery] = React.useState(
    !!initialQueryArgs.conditions.length,
  );
  useEffect(() => {
    if (!showQuery) {
      void createBlock({
        parentUid: initialQueryArgs.conditionsNodesUid,
        node: {
          text: "clause",
          children: [
            {
              text: "source",
              children: [{ text: DEFAULT_RETURN_NODE }],
            },
            {
              text: "relation",
              children: [{ text: "is a" }],
            },
            {
              text: "target",
              children: [
                {
                  text: node.text,
                },
              ],
            },
          ],
        },
      }).then(() => {
        setDiscourseNodeSetting(node.type, ["index"], {
          conditions: [
            {
              type: "clause",
              source: DEFAULT_RETURN_NODE,
              relation: "is a",
              target: node.text,
            },
          ],
          selections: [],
          custom: "",
          returnNode: DEFAULT_RETURN_NODE,
        });

        setShowQuery(true);
      });
    }
  }, [parentUid, initialQueryArgs, showQuery, node.text, node.type]);
  return (
    <ExtensionApiContextProvider {...onloadArgs}>
      {showQuery ? (
        <QueryBuilder pageUid={parentUid} discourseNodeType={node.type} settingKey="index" />
      ) : (
        <Spinner />
      )}
    </ExtensionApiContextProvider>
  );
};

export default NodeIndex;
