import React, { useRef, useEffect, useCallback } from "react";
import { Label } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import createBlock from "roamjs-components/writes/createBlock";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import type { TreeNode } from "roamjs-components/types";
import type { RoamNodeType } from "../utils/zodSchema";
import { setDiscourseNodeSetting } from "../utils/accessors";
import type { DiscourseNodeBaseProps } from "./BlockPropSettingPanels";

const DEBOUNCE_MS = 250;

type DualWriteBlocksPanelProps = DiscourseNodeBaseProps & {
  uid: string;
};

const serializeBlockTree = (children: TreeNode[]): RoamNodeType[] =>
  children
    .sort((a, b) => a.order - b.order)
    .map((child) => ({
      text: child.text,
      ...(child.children.length > 0 && {
        children: serializeBlockTree(child.children),
      }),
    }));

const DualWriteBlocksPanel = ({
  nodeType,
  settingKeys,
  title,
  description,
  uid,
}: DualWriteBlocksPanelProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef(0);
  const pullWatchArgsRef = useRef<
    [string, string, (before: unknown, after: unknown) => void] | null
  >(null);

  const handleChange = useCallback(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const tree = getFullTreeByParentUid(uid);
      const serialized = serializeBlockTree(tree.children);
      setDiscourseNodeSetting(nodeType, settingKeys, serialized);
    }, DEBOUNCE_MS);
  }, [uid, nodeType, settingKeys]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!getFirstChildUidByBlockUid(uid)) {
      void createBlock({ node: { text: " " }, parentUid: uid }).then(() => {
        el.innerHTML = "";
        void window.roamAlphaAPI.ui.components.renderBlock({ uid, el });
      });
    } else {
      el.innerHTML = "";
      void window.roamAlphaAPI.ui.components.renderBlock({ uid, el });
    }

    const pattern = "[:block/string {:block/children ...}]";
    const entityId = `[:block/uid "${uid}"]`;
    const callback = () => handleChange();
    pullWatchArgsRef.current = [pattern, entityId, callback];
    window.roamAlphaAPI.data.addPullWatch(pattern, entityId, callback);

    return () => {
      window.clearTimeout(debounceRef.current);
      if (pullWatchArgsRef.current) {
        window.roamAlphaAPI.data.removePullWatch(...pullWatchArgsRef.current);
        pullWatchArgsRef.current = null;
      }
    };
  }, [uid, handleChange]);

  return (
    <>
      <Label>
        {title}
        <Description description={description} />
      </Label>
      <style>{`.roamjs-dualwrite-blocks > div > .rm-block-main {
    display: none;
  }
  .roamjs-dualwrite-blocks > div > .rm-block-children > .rm-multibar {
    display: none;
  }
  .roamjs-dualwrite-blocks > div > .rm-block-children {
    margin-left: -4px;
  }`}</style>
      <div
        ref={containerRef}
        style={{
          border: "1px solid #33333333",
          padding: "8px 0",
          borderRadius: 4,
        }}
        className="roamjs-dualwrite-blocks"
      />
    </>
  );
};

export default DualWriteBlocksPanel;
