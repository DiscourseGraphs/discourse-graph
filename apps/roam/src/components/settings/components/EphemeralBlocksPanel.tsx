import React, { useRef, useEffect, useCallback } from "react";
import { Label } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import createBlock from "roamjs-components/writes/createBlock";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getFirstChildUidByBlockUid from "roamjs-components/queries/getFirstChildUidByBlockUid";
import type { InputTextNode, TreeNode } from "roamjs-components/types";
import type { RoamNodeType } from "~/components/settings/utils/zodSchema";
import { setDiscourseNodeSetting } from "~/components/settings/utils/accessors";
import type { DiscourseNodeBaseProps } from "./BlockPropSettingPanels";

const DEBOUNCE_MS = 250;

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
    if (!el || !uid) return;

    const pattern = "[:block/string :block/order {:block/children ...}]";
    const entityId = `[:block/uid "${uid}"]`;
    const callback = () => handleChange();

    const registerPullWatch = () => {
      pullWatchArgsRef.current = [pattern, entityId, callback];
      window.roamAlphaAPI.data.addPullWatch(pattern, entityId, callback);
    };

    const dv = defaultValueRef.current;
    const ensureChildren = getFirstChildUidByBlockUid(uid)
      ? Promise.resolve()
      : (dv && dv.length > 0
          ? Promise.all(
              dv.map((node, i) =>
                createBlock({ node, parentUid: uid, order: i }),
              ),
            )
          : createBlock({ node: { text: " " }, parentUid: uid })
        ).then(() => {});

    void ensureChildren.then(() => {
      el.innerHTML = "";
      void window.roamAlphaAPI.ui.components.renderBlock({ uid, el });
      registerPullWatch();
    });

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
