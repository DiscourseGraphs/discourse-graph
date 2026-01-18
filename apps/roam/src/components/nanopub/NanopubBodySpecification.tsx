import React, { useEffect, useMemo, useState } from "react";
import { Card, Spinner } from "@blueprintjs/core";
import parseQuery, { DEFAULT_RETURN_NODE } from "../../utils/parseQuery";
import createBlock from "roamjs-components/writes/createBlock";
import QueryEditor from "../QueryEditor";
import { getSubTree } from "roamjs-components/util";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";

const initialQueryConditionBlocks = [
  {
    text: "clause",
    children: [
      {
        text: "source",
        children: [{ text: DEFAULT_RETURN_NODE }],
      },
      {
        text: "relation",
        children: [{ text: "is in page with title" }],
      },
      {
        text: "target",
        children: [
          {
            text: ":in NODETEXT",
          },
        ],
      },
    ],
  },
  {
    text: "clause",
    children: [
      {
        text: "source",
        children: [{ text: DEFAULT_RETURN_NODE }],
      },
      {
        text: "relation",
        children: [{ text: "with text" }],
      },
      {
        text: "target",
        children: [
          {
            text: "/^content$/i",
          },
        ],
      },
    ],
  },
];

const NanopubBodySpecification = ({
  nanopubConfigUid,
  hidden = true,
}: {
  nanopubConfigUid: string;
  hidden?: boolean;
}) => {
  if (hidden) return null;
  const tree = useMemo(
    () => getBasicTreeByParentUid(nanopubConfigUid),
    [nanopubConfigUid],
  );
  const customBodyDefinitionUid = useMemo(
    () =>
      getSubTree({
        tree,
        parentUid: nanopubConfigUid,
        key: "custom-body-definition",
      }).uid,
    [tree, nanopubConfigUid],
  );
  const initialQueryArgs = useMemo(
    () => parseQuery(customBodyDefinitionUid),
    [customBodyDefinitionUid],
  );
  const [showQuery, setShowQuery] = useState(
    !!initialQueryArgs.conditions.length,
  );

  const createInitialQueryblocks = async () => {
    for (const block of initialQueryConditionBlocks) {
      await createBlock({
        parentUid: initialQueryArgs.conditionsNodesUid,
        order: "last",
        node: block,
      });
    }
    setShowQuery(true);
  };

  useEffect(() => {
    if (!showQuery && !hidden) createInitialQueryblocks();
  }, [customBodyDefinitionUid, initialQueryArgs, showQuery, hidden]);

  return (
    <>
      <div className="my-2">
        You can add the variables <code>:in NODETEXT</code> or{" "}
        <code>:in NODETITLE</code> which will grab the current pages's text or
        title.
      </div>
      <Card className="m-0 p-1">
        {showQuery ? (
          <QueryEditor parentUid={customBodyDefinitionUid} hideCustomSwitch />
        ) : (
          <Spinner />
        )}
      </Card>
    </>
  );
};

export default NanopubBodySpecification;
