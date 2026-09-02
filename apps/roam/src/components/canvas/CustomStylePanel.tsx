import React, { ReactElement, useEffect, useMemo, useState } from "react";
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
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import type { DiscourseContextResults } from "~/components/DiscourseContext";
import findDiscourseNode from "~/utils/findDiscourseNode";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { RenderRoamBlockString } from "~/utils/roamReactComponents";
import { withAutoCanvasRelationsSuppressed } from "./autoCanvasRelationsSuppression";
import { getAllRelations, isDiscourseNodeShape } from "./canvasUtils";
import {
  DISCOURSE_NODE_SHAPE_TYPE,
  DiscourseNodeShape,
  getDiscourseNodeTypeId,
} from "./DiscourseNodeUtil";
import { getRelationColor } from "./DiscourseRelationShape/DiscourseRelationUtil";
import {
  getParallelArrowBend,
  getRelationArrowsBetween,
} from "./DiscourseRelationShape/helpers";
import { dispatchToastEvent } from "./ToastListener";

const NEW_NODE_OFFSET_PX = 80;
const NEW_NODE_GAP_PX = 24;

const ContextTabContent = ({
  shape,
}: {
  shape: DiscourseNodeShape;
}): ReactElement => {
  const editor = useEditor();
  const extensionAPI = useExtensionAPI();
  const [results, setResults] = useState<DiscourseContextResults | null>(null);
  const [failed, setFailed] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
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

  const getNodeShapeByUid = (
    relatedUid: string,
  ): DiscourseNodeShape | undefined =>
    editor
      .getCurrentPageShapes()
      .filter((s): s is DiscourseNodeShape => isDiscourseNodeShape(editor, s))
      .find((s) => s.props.uid === relatedUid);

  const relationIdsInResults = useMemo(
    () =>
      new Set(
        (results ?? []).flatMap((relation) =>
          Object.values(relation.results).flatMap((result) =>
            result.id ? [result.id] : [],
          ),
        ),
      ),
    [results],
  );

  const arrowKeysOnCanvas = useValue(
    "discourse-relation-arrow-keys",
    () => {
      const keys = new Set<string>();
      relationIdsInResults.forEach((relationId) => {
        editor.getBindingsToShape(shape.id, relationId).forEach((binding) => {
          const farBinding = editor
            .getBindingsFromShape(binding.fromId, relationId)
            .find((b) => b.toId !== shape.id);
          if (!farBinding) return;
          const farShape = editor.getShape(farBinding.toId);
          if (farShape && isDiscourseNodeShape(editor, farShape)) {
            keys.add(`${relationId}:${farShape.props.uid}`);
          }
        });
      });
      return keys;
    },
    [editor, shape.id, relationIdsInResults],
  );

  const addNodeToCanvas = async ({
    relatedUid,
    text,
  }: {
    relatedUid: string;
    text: string;
  }): Promise<DiscourseNodeShape | undefined> => {
    if (!extensionAPI) return undefined;
    const node = findDiscourseNode({ uid: relatedUid });
    if (!node) {
      dispatchToastEvent({
        id: "dg-context-tab-missing-node",
        title: "Could not find a discourse node for this result.",
        severity: "error",
      });
      return undefined;
    }
    const { w, h, imageUrl } = await calcCanvasNodeSizeAndImg({
      nodeText: text,
      uid: relatedUid,
      nodeType: node.type,
      extensionAPI,
    });
    const existing = getNodeShapeByUid(relatedUid);
    if (existing) return existing;
    const anchorBounds = editor.getShapePageBounds(shape.id);
    if (!anchorBounds) return undefined;
    const x = anchorBounds.maxX + NEW_NODE_OFFSET_PX;
    const columnBottoms = editor
      .getCurrentPageShapes()
      .filter((s): s is DiscourseNodeShape => isDiscourseNodeShape(editor, s))
      .flatMap((s) => {
        const bounds = editor.getShapePageBounds(s.id);
        return bounds && bounds.minX < x + w && bounds.maxX > x
          ? [bounds.maxY]
          : [];
      });
    const y = columnBottoms.length
      ? Math.max(...columnBottoms) + NEW_NODE_GAP_PX
      : anchorBounds.minY;
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
    return editor.getShape<DiscourseNodeShape>(id);
  };

  const addRelationToCanvas = async ({
    relationId,
    complement,
    relatedUid,
    text,
    label,
  }: {
    relationId: string;
    complement: boolean;
    relatedUid: string;
    text: string;
    label: string;
  }): Promise<void> => {
    const nodeShape =
      getNodeShapeByUid(relatedUid) ??
      (await addNodeToCanvas({ relatedUid, text }));
    if (!nodeShape) return;
    const alreadyOnCanvas = getRelationArrowsBetween({
      editor,
      shapeId: shape.id,
      otherShapeId: nodeShape.id,
      relationIds: new Set([relationId]),
    });
    if (alreadyOnCanvas.length) return;
    const startId = complement ? nodeShape.id : shape.id;
    const endId = complement ? shape.id : nodeShape.id;
    const { bend } = getParallelArrowBend({
      editor,
      startShapeId: startId,
      endShapeId: endId,
      relationIds: new Set(getAllRelations().map((r) => r.id)),
    });
    const arrowId = createShapeId();
    editor
      .createShapes([
        {
          id: arrowId,
          type: relationId,
          props: { color: getRelationColor(label), bend },
        },
      ])
      .createBindings([
        {
          type: relationId,
          fromId: arrowId,
          toId: startId,
          props: { terminal: "start" },
        },
        {
          type: relationId,
          fromId: arrowId,
          toId: endId,
          props: { terminal: "end" },
        },
      ]);
  };

  const toggleRelationOnCanvas = async ({
    relationId,
    complement,
    relatedUid,
    text,
    label,
  }: {
    relationId: string;
    complement: boolean;
    relatedUid: string;
    text: string;
    label: string;
  }): Promise<void> => {
    const key = `${relationId}:${relatedUid}`;
    setPendingKeys((prev) => [...prev, key]);
    try {
      const nodeShape = getNodeShapeByUid(relatedUid);
      const existingArrows = nodeShape
        ? getRelationArrowsBetween({
            editor,
            shapeId: shape.id,
            otherShapeId: nodeShape.id,
            relationIds: new Set([relationId]),
          })
        : [];
      if (existingArrows.length) {
        const bindingIds = existingArrows
          .flatMap((arrow) => editor.getBindingsFromShape(arrow.id, relationId))
          .map((b) => b.id);
        editor
          .deleteShapes(existingArrows.map((a) => a.id))
          .deleteBindings(bindingIds);
      } else {
        await addRelationToCanvas({
          relationId,
          complement,
          relatedUid,
          text,
          label,
        });
      }
    } catch {
      dispatchToastEvent({
        id: "dg-context-tab-toggle-failed",
        title: "Failed to update the canvas for this result.",
        severity: "error",
      });
    } finally {
      setPendingKeys((prev) => prev.filter((k) => k !== key));
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
              const relationId = result.id;
              const key = `${relationId}:${relatedUid}`;
              const onCanvas = !!relationId && arrowKeysOnCanvas.has(key);
              return (
                <li
                  key={relatedUid}
                  className="flex items-center justify-between gap-2 py-1"
                >
                  <span
                    className="min-w-0 flex-1 truncate text-sm"
                    title={text}
                  >
                    <RenderRoamBlockString
                      string={
                        getPageTitleByPageUid(relatedUid) ? `[[${text}]]` : text
                      }
                    />
                  </span>
                  {relationId && (
                    <Button
                      minimal
                      small
                      icon={onCanvas ? "minus" : "plus"}
                      title={
                        onCanvas
                          ? "Remove relation from canvas"
                          : "Add relation to canvas"
                      }
                      loading={pendingKeys.includes(key)}
                      onClick={() =>
                        void toggleRelationOnCanvas({
                          relationId,
                          complement: result.complement === 1,
                          relatedUid,
                          text,
                          label: relation.label,
                        })
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};

const NodeCardPanelContent = ({
  shape,
}: {
  shape: DiscourseNodeShape;
}): ReactElement => {
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

export const CustomStylePanel = (props: TLUiStylePanelProps): ReactElement => {
  const editor = useEditor();
  const selectedNodeShape = useValue(
    "selected-discourse-node-shape",
    () => {
      const selected = editor.getOnlySelectedShape();
      if (!selected || !isDiscourseNodeShape(editor, selected)) return null;
      return ["blck-node", "page-node"].includes(
        getDiscourseNodeTypeId({ shape: selected }),
      )
        ? null
        : selected;
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
