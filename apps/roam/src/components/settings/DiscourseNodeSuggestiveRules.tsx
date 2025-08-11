import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { Button, Intent, Tooltip, Position } from "@blueprintjs/core";
import BlocksPanel from "roamjs-components/components/ConfigPanels/BlocksPanel";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import refreshConfigTree from "~/utils/refreshConfigTree";
import FlagPanel from "roamjs-components/components/ConfigPanels/FlagPanel";
import { getUidAndBooleanSetting } from "~/utils/getExportSettings";
import TextPanel from "roamjs-components/components/ConfigPanels/TextPanel";
import getSubTree from "roamjs-components/util/getSubTree";
import { DiscourseNode } from "~/utils/getDiscourseNodes";

const getNodeConfig = (parentUid: string) => {
  const tree = getBasicTreeByParentUid(parentUid);
  const embeddingRefNode = tree.find((n) =>
    n.text.startsWith("Embedding Block Ref"),
  );
  const match = embeddingRefNode?.children?.[0]?.text?.match(/\(\((.*)\)\)/);
  const blockRef = match ? `((${match[1]}))` : "";
  return {
    embeddingRef: blockRef,
    embeddingRefUid: embeddingRefNode?.uid || "",
    isFirstChild: getUidAndBooleanSetting({
      tree: tree,
      text: "First Child",
    }),
  };
};

const BlockRenderer = ({ uid }: { uid: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      if (uid) {
        window.roamAlphaAPI.ui.components.renderBlock({
          uid: uid,
          el: container,
        });
      }
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
  const [nodeConfigTree, setNodeConfigTree] = useState(() =>
    getNodeConfig(parentUid),
  );

  useEffect(() => {
    refreshConfigTree();
    setNodeConfigTree(getNodeConfig(parentUid));
  }, [parentUid]);

  const [embeddingRef, setEmbeddingRef] = useState(nodeConfigTree.embeddingRef);

  useEffect(() => {
    if (nodeConfigTree.embeddingRef !== embeddingRef) {
      setEmbeddingRef(nodeConfigTree.embeddingRef);
    }
  }, [nodeConfigTree.embeddingRef]);

  const blockUidToRender = useMemo(() => {
    const match = embeddingRef?.match(/\(\((.*)\)\)/);
    return match ? match[1] : "";
  }, [embeddingRef]);

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
        uid={nodeConfigTree.embeddingRefUid}
        parentUid={parentUid}
        defaultValue={nodeConfigTree.embeddingRef}
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
        description="If the block is the first child of the template, it will be embedded and ranked."
        order={1}
        uid={nodeConfigTree.isFirstChild.uid}
        parentUid={parentUid}
        value={nodeConfigTree.isFirstChild.value}
      />

      <div className="flex items-center gap-2">
        <Tooltip
          content="Save changes before updating embeddings"
          position={Position.TOP}
        >
          <Button
            text="Update Embeddings"
            intent={Intent.NONE}
            onClick={() => console.log("Not implemented")}
            style={{ minWidth: "140px" }}
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default DiscourseNodeSuggestiveRules;
