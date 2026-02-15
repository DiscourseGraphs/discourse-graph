import React, { useState, useMemo, useEffect, useRef } from "react";
import { Button, Intent } from "@blueprintjs/core";
import DualWriteBlocksPanel from "./components/EphemeralBlocksPanel";
import getSubTree from "roamjs-components/util/getSubTree";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import extractRef from "roamjs-components/util/extractRef";
import { getAllDiscourseNodesSince } from "~/utils/getAllDiscourseNodesSince";
import { upsertNodesToSupabaseAsContentWithEmbeddings } from "~/utils/syncDgNodesToSupabase";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";
import {
  DiscourseNodeFlagPanel,
  DiscourseNodeTextPanel,
} from "./components/BlockPropSettingPanels";

const BlockRenderer = ({ uid }: { uid: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.innerHTML = "";

      window.roamAlphaAPI.ui.components.renderBlock({
        uid: uid,
        el: container,
      });
    }
  }, [uid]);

  return <div ref={containerRef} className="my-2 rounded border p-2" />;
};

const DiscourseNodeSuggestiveRules = ({
  node,
  parentUid,
}: {
  node: DiscourseNode;
  parentUid: string;
}) => {
  const nodeUid = node.type;
  const nodeType = node.type;

  const [embeddingRef, setEmbeddingRef] = useState(node.embeddingRef || "");
  const blockUidToRender = useMemo(
    () => extractRef(embeddingRef),
    [embeddingRef],
  );

  const templateUid = useMemo(
    () =>
      getSubTree({
        parentUid: nodeUid,
        key: "Template",
      }).uid || "",
    [nodeUid],
  );

  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateEmbeddings = async (): Promise<void> => {
    setIsUpdating(true);
    try {
      const blockNodesSince = await getAllDiscourseNodesSince(
        new Date(0).toISOString(),
        [node],
      );
      const supabaseClient = await getLoggedInClient();
      if (!supabaseClient) return;

      const context = await getSupabaseContext();
      if (context && blockNodesSince) {
        await upsertNodesToSupabaseAsContentWithEmbeddings(
          blockNodesSince,
          supabaseClient,
          context,
        );
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <DualWriteBlocksPanel
        nodeType={node.type}
        title="Template"
        description={`The template that auto fills ${node.text} page when generated.`}
        settingKeys={["template"]}
        uid={templateUid}
      />

      <DiscourseNodeTextPanel
        nodeType={nodeType}
        title="Embedding Block Ref"
        description="Copy block ref from template which you want to be embedded and ranked."
        settingKeys={["suggestiveRules", "embeddingRef"]}
        initialValue={node.embeddingRef || ""}
        placeholder="((block-uid))"
        onChange={setEmbeddingRef}
        order={1}
        uid={node.embeddingRefUid || ""}
        parentUid={parentUid}
      />

      {blockUidToRender && (
        <div>
          <div className="mb-1 text-sm text-gray-600">Preview:</div>
          <BlockRenderer uid={blockUidToRender} />
        </div>
      )}

      <DiscourseNodeFlagPanel
        nodeType={nodeType}
        title="First Child"
        description="If the block is the first child of the embedding block ref, it will be embedded and ranked."
        settingKeys={["suggestiveRules", "isFirstChild"]}
        initialValue={node.isFirstChild?.value || false}
        order={2}
        uid={node.isFirstChild?.uid || ""}
        parentUid={parentUid}
      />

      <Button
        text="Update embeddings"
        intent={Intent.NONE}
        onClick={() => void handleUpdateEmbeddings()}
        loading={isUpdating}
        className="w-52"
      />
    </div>
  );
};

export default DiscourseNodeSuggestiveRules;
