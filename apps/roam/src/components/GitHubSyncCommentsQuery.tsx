import React, { useEffect, useMemo, useState } from "react";
import { Spinner } from "@blueprintjs/core";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import type { OnloadArgs } from "roamjs-components/types/native";
import QueryBuilder from "~/components/QueryBuilder";
import parseQuery, { DEFAULT_RETURN_NODE } from "~/utils/parseQuery";
import createBlock from "roamjs-components/writes/createBlock";
import sendErrorEmail from "~/utils/sendErrorEmail";

const CommentsQuery = ({
  parentUid,
  onloadArgs,
}: {
  parentUid: string;
  onloadArgs: OnloadArgs;
}) => {
  const initialQueryArgs = useMemo(() => parseQuery(parentUid), [parentUid]);
  const [showQuery, setShowQuery] = useState(
    !!initialQueryArgs.conditions.length,
  );

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
              text: "Comments",
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
          children: [{ text: "has heading" }],
        },
        {
          text: "target",
          children: [
            {
              text: "1",
            },
          ],
        },
      ],
    },
  ];

  const createInitialQueryblocks = async () => {
    try {
      for (const block of initialQueryConditionBlocks) {
        await createBlock({
          parentUid: initialQueryArgs.conditionsNodesUid,
          order: "last",
          node: block,
        });
      }
      setShowQuery(true);
    } catch (error) {
      const e = error as Error;

      await sendErrorEmail({
        error: e,
        type: "GitHub Sync - Query Block Creation Failed",
        context: {
          parentUid,
          conditionsNodesUid: initialQueryArgs.conditionsNodesUid,
          blockCount: initialQueryConditionBlocks.length,
        },
      }).catch(() => {});

      console.error("Failed to create initial query blocks:", e);
      // Still show the query even if block creation fails
      setShowQuery(true);
    }
  };

  useEffect(() => {
    if (!showQuery) {
      createInitialQueryblocks().catch((error) => {
        const e = error as Error;

        sendErrorEmail({
          error: e,
          type: "GitHub Sync - Query Initialization Failed",
          context: {
            parentUid,
            showQuery,
            errorMessage: e.message,
          },
        }).catch(() => {});

        console.error("Failed to initialize query:", e);
      });
    }
  }, [parentUid, initialQueryArgs, showQuery]);

  return (
    <ExtensionApiContextProvider {...onloadArgs}>
      {showQuery ? <QueryBuilder pageUid={parentUid} /> : <Spinner />}
    </ExtensionApiContextProvider>
  );
};

export default CommentsQuery;
