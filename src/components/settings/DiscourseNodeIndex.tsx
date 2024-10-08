import React, { useEffect } from "react";
import { Spinner } from "@blueprintjs/core";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import type { OnloadArgs } from "roamjs-components/types/native";
import type { DiscourseNode } from "../../utils/getDiscourseNodes";
import QueryBuilder from "../QueryBuilder";
import parseQuery, { DEFAULT_RETURN_NODE } from "../../utils/parseQuery";
import createBlock from "roamjs-components/writes/createBlock";

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
    [parentUid]
  );
  const [showQuery, setShowQuery] = React.useState(
    !!initialQueryArgs.conditions.length
  );
  useEffect(() => {
    if (!showQuery) {
      createBlock({
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
      }).then(() => setShowQuery(true));
    }
  }, [parentUid, initialQueryArgs, showQuery]);
  return (
    <ExtensionApiContextProvider {...onloadArgs}>
      {showQuery ? <QueryBuilder pageUid={parentUid} /> : <Spinner />}
    </ExtensionApiContextProvider>
  );
};

export default NodeIndex;
