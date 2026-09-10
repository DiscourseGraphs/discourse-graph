import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Box,
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
import { useDiscourseContextMutationRefresh } from "~/utils/discourseContextMutationRefresh";
import type { DiscourseContextResults } from "~/components/DiscourseContext";
import findDiscourseNode from "~/utils/findDiscourseNode";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { RenderRoamBlockString } from "~/utils/roamReactComponents";
import { getPersonalSetting } from "~/components/settings/utils/accessors";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";
import { withAutoCanvasRelationsSuppressed } from "./autoCanvasRelationsSuppression";
import { getAllRelations, isDiscourseNodeShape } from "./canvasUtils";
import {
  DISCOURSE_NODE_SHAPE_TYPE,
  DiscourseNodeShape,
  DiscourseNodeUtil,
  getDiscourseNodeTypeId,
} from "./DiscourseNodeUtil";
import { getRelationColor } from "./DiscourseRelationShape/DiscourseRelationUtil";
import { getParallelArrowBend } from "./DiscourseRelationShape/helpers";
import { dispatchToastEvent } from "./ToastListener";

const NEW_NODE_OFFSET_PX = 80;
const NEW_NODE_GAP_PX = 24;
const CAMERA_INSET_PX = 64;

const ContextTabContent = ({
  shape,
}: {
  shape: DiscourseNodeShape;
}): ReactElement => {
  const editor = useEditor();
  const extensionAPI = useExtensionAPI();
  const [results, setResults] = useState<DiscourseContextResults | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [pendingUids, setPendingUids] = useState<string[]>([]);
  const uid = shape.props.uid;

  useEffect(() => {
    setResults(null);
  }, [uid]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    getDiscourseContextResults({ uid, ignoreCache: refreshCount > 0 })
      .then((r) => {
        if (!cancelled) setResults(r);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [uid, refreshCount]);

  const onMutationRefresh = useCallback(
    () => setRefreshCount((count) => count + 1),
    [],
  );
  useDiscourseContextMutationRefresh({ uid, onMutationRefresh });

  const getNodeShapeByUid = (
    relatedUid: string,
  ): DiscourseNodeShape | undefined =>
    editor
      .getCurrentPageShapes()
      .filter((s): s is DiscourseNodeShape => isDiscourseNodeShape(editor, s))
      .find((s) => s.props.uid === relatedUid);

  const relatedUids = useMemo(
    () => (results ?? []).flatMap((relation) => Object.keys(relation.results)),
    [results],
  );

  const pageUidsInResults = useMemo(
    () => new Set(relatedUids.filter((u) => getPageTitleByPageUid(u))),
    [relatedUids],
  );

  const uidsOnCanvas = useValue(
    "discourse-node-uids-on-canvas",
    () =>
      new Set(
        editor
          .getCurrentPageShapes()
          .filter((s): s is DiscourseNodeShape =>
            isDiscourseNodeShape(editor, s),
          )
          .map((s) => s.props.uid),
      ),
    [editor],
  );

  const getFreePositionInColumn = ({
    anchorBounds,
    w,
    h,
  }: {
    anchorBounds: Box;
    w: number;
    h: number;
  }): { x: number; y: number } => {
    const x = anchorBounds.maxX + NEW_NODE_OFFSET_PX;
    const blockers = editor
      .getCurrentPageShapes()
      .filter((s): s is DiscourseNodeShape => isDiscourseNodeShape(editor, s))
      .flatMap((s) => {
        const bounds = editor.getShapePageBounds(s.id);
        return bounds && bounds.minX < x + w && bounds.maxX > x ? [bounds] : [];
      })
      .sort((a, b) => a.minY - b.minY);
    let y = anchorBounds.minY;
    for (const blocker of blockers) {
      if (blocker.maxY + NEW_NODE_GAP_PX <= y) continue;
      if (blocker.minY >= y + h + NEW_NODE_GAP_PX) break;
      y = blocker.maxY + NEW_NODE_GAP_PX;
    }
    return { x, y };
  };

  const bringIntoView = ({
    anchorBounds,
    shapeId,
  }: {
    anchorBounds: Box;
    shapeId: DiscourseNodeShape["id"];
  }): void => {
    const newBounds = editor.getShapePageBounds(shapeId);
    if (!newBounds || Box.Contains(editor.getViewportPageBounds(), newBounds))
      return;
    editor.zoomToBounds(Box.Common([anchorBounds, newBounds]), {
      inset: CAMERA_INSET_PX,
      animation: { duration: 200 },
    });
  };

  const drawRelationArrow = ({
    nodeShape,
    relationId,
    complement,
    label,
  }: {
    nodeShape: DiscourseNodeShape;
    relationId: string;
    complement: boolean;
    label: string;
  }): void => {
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

  const addNodeToCanvas = async ({
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
    if (getNodeShapeByUid(relatedUid)) return;
    const anchorBounds = editor.getShapePageBounds(shape.id);
    if (!anchorBounds) return;
    const { x, y } = getFreePositionInColumn({ anchorBounds, w, h });
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
    bringIntoView({ anchorBounds, shapeId: id });
    const autoCanvasRelations = getPersonalSetting<boolean>([
      PERSONAL_KEYS.autoCanvasRelations,
    ]);
    const util = editor.getShapeUtil(created);
    if (autoCanvasRelations && util instanceof DiscourseNodeUtil) {
      await util.createExistingRelations({ shape: created });
      return;
    }
    drawRelationArrow({ nodeShape: created, relationId, complement, label });
  };

  const toggleNodeOnCanvas = async ({
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
    setPendingUids((prev) => [...prev, relatedUid]);
    try {
      const nodeShape = getNodeShapeByUid(relatedUid);
      if (nodeShape) {
        editor.deleteShapes([nodeShape.id]);
      } else {
        await addNodeToCanvas({
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
    <div className="max-h-96 space-y-3 overflow-y-auto p-3">
      {results.map((relation) => (
        <div key={relation.label}>
          <div className="mb-1 text-xs font-semibold text-gray-500">
            {relation.label}
          </div>
          <ul className="m-0 list-none p-0">
            {Object.entries(relation.results).map(([relatedUid, result]) => {
              const text = result.text ?? relatedUid;
              const relationId = result.id;
              const onCanvas = uidsOnCanvas.has(relatedUid);
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
                        pageUidsInResults.has(relatedUid) ? `[[${text}]]` : text
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
                          ? "Remove node from canvas"
                          : "Add node to canvas"
                      }
                      loading={pendingUids.includes(relatedUid)}
                      onClick={() =>
                        void toggleNodeOnCanvas({
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
