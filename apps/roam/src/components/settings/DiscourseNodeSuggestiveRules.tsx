/* eslint-disable @typescript-eslint/naming-convention */
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Button, Intent } from "@blueprintjs/core";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import getSubTree from "roamjs-components/util/getSubTree";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import extractRef from "roamjs-components/util/extractRef";
import { getDiscourseNodeTypeWithSettingsBlockNodes } from "~/utils/getAllDiscourseNodesSince";
import { upsertNodesToSupabaseAsContentWithEmbeddings } from "~/utils/syncDgNodesToSupabase";
import { discourseNodeBlockToLocalConcept } from "~/utils/conceptConversion";
import { getLoggedInClient, getSupabaseContext } from "~/utils/supabaseContext";

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

  const [embeddingRef, setEmbeddingRef] = useState(node.embeddingRef);

  useEffect(() => {
    setEmbeddingRef(node.embeddingRef || "");
  }, [node.embeddingRef]);

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

  const handleEmbeddingRefChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setEmbeddingRef(newValue);
    },
    [],
  );

  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateEmbeddings = async () => {
    setIsUpdating(true);
    const blockNodesSince = getDiscourseNodeTypeWithSettingsBlockNodes(node, 0);
    const supabaseClient = await getLoggedInClient();
    const context = await getSupabaseContext();
    if (context && blockNodesSince) {
      await upsertNodesToSupabaseAsContentWithEmbeddings(
        blockNodesSince,
        supabaseClient,
        context,
      );
      const nodeBlockToLocalConcepts = blockNodesSince.map((node) => {
        const localConcept = discourseNodeBlockToLocalConcept(context, {
          nodeUid: node.source_local_id,
          schemaUid: node.type,
          text: node.node_title ? `${node.node_title} ${node.text}` : node.text,
        });
        return localConcept;
      });

      const { error } = await supabaseClient.rpc("upsert_concepts", {
        data: nodeBlockToLocalConcepts,
        v_space_id: context.spaceId,
      });
      if (error) {
        throw new Error(
          `upsert_concepts failed: ${JSON.stringify(error, null, 2)}`,
        );
      }
    }
    setIsUpdating(false);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <BlocksPanel
        title="Template"
        description={`The template that auto fills ${node.text} page when generated.`}
        order={0}
        parentUid={nodeUid}
        uid={templateUid}
        defaultValue={node.template}
      />

      <TextPanel
        title="Embedding Block Ref"
        description="Copy block ref from template which you want to be embedded and ranked."
        order={0}
        uid={node.embeddingRefUid}
        parentUid={parentUid}
        value={node.embeddingRef}
        defaultValue={node.embeddingRef}
        options={{
          placeholder: "((block-uid))",
          onChange: handleEmbeddingRefChange,
        }}
      />

      {blockUidToRender && (
        <div>
          <div className="mb-1 text-sm text-gray-600">Preview:</div>
          <BlockRenderer uid={blockUidToRender} />
        </div>
      )}

      <FlagPanel
        title="First Child"
        description="If the block is the first child of the embedding block ref, it will be embedded and ranked."
        order={1}
        uid={node.isFirstChild?.uid || ""}
        parentUid={parentUid}
        value={node.isFirstChild?.value || false}
      />

      <Button
        text="Update Embeddings"
        intent={Intent.NONE}
        onClick={() => void handleUpdateEmbeddings()}
        loading={isUpdating}
        className="w-52"
      />
    </div>
  );
};

export default DiscourseNodeSuggestiveRules;
