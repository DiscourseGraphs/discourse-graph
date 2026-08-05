import React, { useEffect, useState } from "react";
import {
  DefaultStylePanel,
  DefaultStylePanelContent,
  TLUiStylePanelProps,
  createShapeId,
  useEditor,
  useRelevantStyles,
  useValue,
} from "tldraw";
import { Button, Tab, Tabs } from "@blueprintjs/core";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import type { DiscourseContextResults } from "~/components/DiscourseContext";
import findDiscourseNode from "~/utils/findDiscourseNode";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { withAutoCanvasRelationsSuppressed } from "./autoCanvasRelationsSuppression";
import { isDiscourseNodeShape } from "./canvasUtils";
import {
  DISCOURSE_NODE_SHAPE_TYPE,
  DiscourseNodeShape,
  DiscourseNodeUtil,
} from "./DiscourseNodeUtil";
import { dispatchToastEvent } from "./ToastListener";

const NEW_NODE_OFFSET_PX = 80;
const NEW_NODE_GAP_PX = 24;

const ContextTabContent = ({ shape }: { shape: DiscourseNodeShape }) => {
  const editor = useEditor();
  const extensionAPI = useExtensionAPI();
  const [results, setResults] = useState<DiscourseContextResults | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingUids, setPendingUids] = useState<string[]>([]);
  const uid = shape.props.uid;

  useEffect(() => {
    let cancelled = false;
    setResults(null);
    setFailed(false);
    getDiscourseContextResults({ uid })
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const nodeShapesByUid = useValue(
    "discourse-node-shapes-by-uid",
    () =>
      new Map(
        editor
          .getCurrentPageShapes()
          .filter((s): s is DiscourseNodeShape =>
            isDiscourseNodeShape(editor, s),
          )
          .map((s) => [s.props.uid, s]),
      ),
    [editor],
  );

  const removeFromCanvas = (nodeShape: DiscourseNodeShape) => {
    const util = editor.getShapeUtil(nodeShape);
    if (util instanceof DiscourseNodeUtil) {
      util.deleteRelationsInCanvas({ shape: nodeShape });
    }
    editor.deleteShapes([nodeShape.id]);
  };

  const addToCanvas = async ({
    relatedUid,
    text,
  }: {
    relatedUid: string;
    text: string;
  }) => {
    if (!extensionAPI) return;
    const node = findDiscourseNode({ uid: relatedUid });
    if (!node) {
      dispatchToastEvent({
        id: "dg-context-tab-missing-node",
        title: "Could not find a discourse node for this result.",
        severity: "error",
      });
      return;
    }
    const { w, h, imageUrl } = await calcCanvasNodeSizeAndImg({
      nodeText: text,
      uid: relatedUid,
      nodeType: node.type,
      extensionAPI,
    });
    const x = shape.x + shape.props.w + NEW_NODE_OFFSET_PX;
    const columnBottoms = editor
      .getCurrentPageShapes()
      .filter((s): s is DiscourseNodeShape => isDiscourseNodeShape(editor, s))
      .filter((s) => s.x < x + w && s.x + s.props.w > x)
      .map((s) => s.y + s.props.h);
    const y = columnBottoms.length
      ? Math.max(...columnBottoms) + NEW_NODE_GAP_PX
      : shape.y;
    const id = createShapeId();
    withAutoCanvasRelationsSuppressed(() =>
      editor.createShapes([
        {
          id,
          type: DISCOURSE_NODE_SHAPE_TYPE,
          x,
          y,
          props: {
            uid: relatedUid,
            title: text,
            w,
            h,
            ...(imageUrl && { imageUrl }),
            size: "s",
            fontFamily: "sans",
            nodeTypeId: node.type,
          },
        },
      ]),
    );
    const created = editor.getShape<DiscourseNodeShape>(id);
    if (!created) return;
    const util = editor.getShapeUtil(created);
    if (util instanceof DiscourseNodeUtil) {
      await util.createExistingRelations({ shape: created });
    }
  };

  const toggleCanvasPresence = async ({
    relatedUid,
    text,
  }: {
    relatedUid: string;
    text: string;
  }) => {
    setPendingUids((prev) => [...prev, relatedUid]);
    try {
      const existing = nodeShapesByUid.get(relatedUid);
      if (existing) {
        removeFromCanvas(existing);
      } else {
        await addToCanvas({ relatedUid, text });
      }
    } catch {
      dispatchToastEvent({
        id: "dg-context-tab-toggle-failed",
        title: "Failed to update the canvas for this result.",
        severity: "error",
      });
    } finally {
      setPendingUids((prev) => prev.filter((u) => u !== relatedUid));
    }
  };

  if (failed) {
    return <div className="p-3 text-sm">Failed to load relations.</div>;
  }
  if (results === null) {
    return <div className="p-3 text-sm">Loading relations...</div>;
  }
  if (results.length === 0) {
    return <div className="p-3 text-sm">No relations found.</div>;
  }

  return (
    <div className="max-h-96 overflow-y-auto p-3">
      {results.map((relation) => (
        <div key={relation.label} className="mb-3 last:mb-0">
          <div className="mb-1 text-xs font-semibold text-gray-500">
            {relation.label}
          </div>
          <ul className="m-0 list-none p-0">
            {Object.entries(relation.results).map(([relatedUid, result]) => {
              const text = result.text ?? relatedUid;
              const onCanvas = nodeShapesByUid.has(relatedUid);
              return (
                <li
                  key={relatedUid}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <span
                    className="min-w-0 flex-1 truncate text-sm"
                    title={text}
                  >
                    {text}
                  </span>
                  <Button
                    minimal
                    small
                    icon={onCanvas ? "minus" : "plus"}
                    title={onCanvas ? "Remove from canvas" : "Add to canvas"}
                    loading={pendingUids.includes(relatedUid)}
                    onClick={() =>
                      void toggleCanvasPresence({ relatedUid, text })
                    }
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

const NodeCardPanelContent = ({ shape }: { shape: DiscourseNodeShape }) => {
  const styles = useRelevantStyles();
  const [activeTab, setActiveTab] = useState<"context" | "styling">("context");
  return (
    <div className="dg-node-style-panel px-2 pt-1">
      <Tabs
        id="dg-node-card-tabs"
        selectedTabId={activeTab}
        onChange={(tabId) =>
          setActiveTab(tabId === "styling" ? "styling" : "context")
        }
        renderActiveTabPanelOnly
      >
        <Tab
          id="context"
          title="Context"
          panel={<ContextTabContent shape={shape} />}
        />
        <Tab
          id="styling"
          title="Styling"
          panel={<DefaultStylePanelContent styles={styles} />}
        />
      </Tabs>
    </div>
  );
};

export const CustomStylePanel = (props: TLUiStylePanelProps) => {
  const editor = useEditor();
  const selectedNodeShape = useValue(
    "selected-discourse-node-shape",
    () => {
      const selected = editor.getOnlySelectedShape();
      return selected && isDiscourseNodeShape(editor, selected)
        ? selected
        : null;
    },
    [editor],
  );
  if (!selectedNodeShape) return <DefaultStylePanel {...props} />;
  return (
    <DefaultStylePanel {...props}>
      <NodeCardPanelContent
        key={selectedNodeShape.id}
        shape={selectedNodeShape}
      />
    </DefaultStylePanel>
  );
};
