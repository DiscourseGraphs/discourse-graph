import React, { useRef, useEffect, useCallback, useState } from "react";
import { Label } from "@blueprintjs/core";
import Description from "~/components/settings/SettingsDescription";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import type { InputTextNode, TreeNode } from "roamjs-components/types";
import type { RoamNodeType } from "~/components/settings/utils/zodSchema";
import {
  isNewSettingsStoreEnabled,
  setDiscourseNodeSetting,
} from "~/components/settings/utils/accessors";
import type { DiscourseNodeBaseProps } from "./BlockPropSettingPanels";

const DEBOUNCE_MS = 250;
const TEMPLATE_BUFFER_TEXT = "Template";

type DualWriteBlocksPanelProps = DiscourseNodeBaseProps & {
  uid: string;
  defaultValue?: InputTextNode[];
};

const serializeBlockTree = (children: TreeNode[]): RoamNodeType[] =>
  children
    .sort((a, b) => a.order - b.order)
    .map((child) => ({
      text: child.text,
      ...(child.heading && { heading: child.heading as 0 | 1 | 2 | 3 }),
      ...(child.open === false && { open: false }),
      ...(child.children.length > 0 && {
        children: serializeBlockTree(child.children),
      }),
    }));

const treeNodeToInputTextNode = (node: TreeNode): InputTextNode => ({
  text: node.text,
  ...(node.heading && { heading: node.heading as 0 | 1 | 2 | 3 }),
  ...(node.open === false && { open: false }),
  ...(node.children.length > 0 && {
    children: [...node.children]
      .sort((a, b) => a.order - b.order)
      .map(treeNodeToInputTextNode),
  }),
});

const mirrorBufferToLegacyChildren = (
  bufferChildren: TreeNode[],
  legacyChildren: TreeNode[],
  legacyParentUid: string,
): void => {
  const sortedBuffer = [...bufferChildren].sort((a, b) => a.order - b.order);
  const sortedLegacy = [...legacyChildren].sort((a, b) => a.order - b.order);
  const minLen = Math.min(sortedBuffer.length, sortedLegacy.length);

  for (let i = 0; i < minLen; i++) {
    const bufferNode = sortedBuffer[i];
    const legacyNode = sortedLegacy[i];
    if (
      bufferNode.text !== legacyNode.text ||
      bufferNode.heading !== legacyNode.heading ||
      bufferNode.open !== legacyNode.open
    ) {
      void window.roamAlphaAPI.data.block.update({
        block: {
          uid: legacyNode.uid,
          string: bufferNode.text,
          ...(bufferNode.heading !== undefined && {
            heading: bufferNode.heading,
          }),
          ...(bufferNode.open !== undefined && { open: bufferNode.open }),
        },
      });
    }
    mirrorBufferToLegacyChildren(
      bufferNode.children,
      legacyNode.children,
      legacyNode.uid,
    );
  }

  for (let i = minLen; i < sortedBuffer.length; i++) {
    const node = treeNodeToInputTextNode(sortedBuffer[i]);
    void createBlock({ node, parentUid: legacyParentUid, order: i });
  }

  for (let i = minLen; i < sortedLegacy.length; i++) {
    void deleteBlock(sortedLegacy[i].uid);
  }
};

const DualWriteBlocksPanel = ({
  nodeType,
  settingKeys,
  title,
  description,
  uid,
  defaultValue,
}: DualWriteBlocksPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef(0);
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;
  const pullWatchArgsRef = useRef<
    [string, string, (before: unknown, after: unknown) => void] | null
  >(null);

  const isNewStore = isNewSettingsStoreEnabled();
  const [bufferUid, setBufferUid] = useState<string | null>(null);
  const renderUid = isNewStore ? bufferUid : uid;

  useEffect(() => {
    if (!isNewStore || !nodeType) return;
    let cancelled = false;
    const newUid = window.roamAlphaAPI.util.generateUID();
    const dv = defaultValueRef.current;
    const seed: InputTextNode[] = dv && dv.length > 0 ? dv : [{ text: " " }];
    void createBlock({
      node: { text: TEMPLATE_BUFFER_TEXT, uid: newUid, children: seed },
      parentUid: nodeType,
      order: "last",
    }).then(() => {
      if (!cancelled) setBufferUid(newUid);
    });
    return () => {
      cancelled = true;
      setBufferUid(null);
      void deleteBlock(newUid);
    };
  }, [isNewStore, nodeType]);

  const handleChange = useCallback(() => {
    if (!renderUid) return;
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const tree = getFullTreeByParentUid(renderUid);
      const serialized = serializeBlockTree(tree.children);
      setDiscourseNodeSetting(nodeType, settingKeys, serialized);
      if (isNewStore && renderUid !== uid) {
        const legacyTree = getFullTreeByParentUid(uid);
        mirrorBufferToLegacyChildren(tree.children, legacyTree.children, uid);
      }
    }, DEBOUNCE_MS);
  }, [renderUid, uid, isNewStore, nodeType, settingKeys]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !renderUid) return;

    let cancelled = false;
    const pattern = "[:block/string :block/order {:block/children ...}]";
    const entityId = `[:block/uid "${renderUid}"]`;
    const callback = () => handleChange();

    const registerPullWatch = () => {
      pullWatchArgsRef.current = [pattern, entityId, callback];
      window.roamAlphaAPI.data.addPullWatch(pattern, entityId, callback);
    };

    const dv = defaultValueRef.current;
    const ensureChildren = getFirstChildUidByBlockUid(renderUid)
      ? Promise.resolve()
      : (dv && dv.length > 0
          ? Promise.all(
              dv.map((node, i) =>
                createBlock({ node, parentUid: renderUid, order: i }),
              ),
            )
          : createBlock({ node: { text: " " }, parentUid: renderUid })
        ).then(() => {});

    void ensureChildren.then(() => {
      if (cancelled) return;
      el.innerHTML = "";
      void window.roamAlphaAPI.ui.components.renderBlock({
        uid: renderUid,
        el,
      });
      registerPullWatch();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(debounceRef.current);
      if (pullWatchArgsRef.current) {
        window.roamAlphaAPI.data.removePullWatch(...pullWatchArgsRef.current);
        pullWatchArgsRef.current = null;
      }
    };
  }, [renderUid, handleChange]);

  return (
    <>
      <Label>
        {title}
        <Description description={description} />
      </Label>
      <style>{`.dg-dualwrite-blocks > div > .rm-block-main {
    display: none;
  }
  .dg-dualwrite-blocks > div > .rm-block-children > .rm-multibar {
    display: none;
  }
  .dg-dualwrite-blocks > div > .rm-block-children {
    margin-left: -4px;
  }`}</style>
      <div
        ref={containerRef}
        className="dg-dualwrite-blocks rounded border border-gray-200 py-2"
      />
    </>
  );
};

export default DualWriteBlocksPanel;
