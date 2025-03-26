import React, { useRef, useState, useMemo, useEffect } from "react";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { Spinner } from "@blueprintjs/core";
import isFlagEnabled from "~/utils/isFlagEnabled";
import {
  App as TldrawApp,
  defineShape,
  TldrawEditorConfig,
  Canvas,
  TldrawEditor,
  ContextMenu,
  TldrawUi,
  TLBoxTool,
  TLArrowTool,
  TLSelectTool,
  DraggingHandle,
  TL_COLOR_TYPES,
  StateNodeConstructor,
  TLArrowShapeProps,
  Vec2dModel,
  createShapeId,
  TLPointerEvent,
  TEXT_PROPS,
  FONT_SIZES,
  FONT_FAMILIES,
  TLShape,
  TLArrowTerminal,
  TLShapeId,
  Translating,
} from "@tldraw/tldraw";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import createBlock from "roamjs-components/writes/createBlock";
import { InputTextNode, OnloadArgs } from "roamjs-components/types";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import createPage from "roamjs-components/writes/createPage";
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import findDiscourseNode from "~/utils/findDiscourseNode";
import renderToast from "roamjs-components/components/Toast";
import triplesToBlocks from "~/utils/triplesToBlocks";
import ExtensionApiContextProvider, {
  useExtensionAPI,
} from "roamjs-components/components/ExtensionApiContext";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { useRoamStore } from "~/utils/useRoamStore";
import { createUiOverrides } from "~/utils/canvasUiOverrides";
import { DiscourseNodeShape, DiscourseNodeUtil } from "./DiscourseNodeUtil";
import {
  AddReferencedNodeType,
  DiscourseReferencedNodeShape,
  DiscourseReferencedNodeUtil,
  DiscourseRelationShape,
  DiscourseRelationUtil,
} from "./DiscourseRelationsUtil";
import { isPageUid } from "~/utils/isPageUid";
import posthog from "posthog-js";
import "@tldraw/tldraw/editor.css";
import "@tldraw/tldraw/ui.css";
import sendErrorEmail from "~/utils/sendErrorEmail";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";

declare global {
  interface Window {
    tldrawApps: Record<string, TldrawApp>;
  }
}

type Props = {
  title: string;
  previewEnabled: boolean;
};

export type DiscourseContextType = {
  // { [Node.id] => DiscourseNode }
  nodes: Record<string, DiscourseNode & { index: number }>;
  // { [Relation.Label] => DiscourseRelation[] }
  relations: Record<string, DiscourseRelation[]>;
  lastAppEvent: string;
};

export const discourseContext: DiscourseContextType = {
  nodes: {},
  relations: {},
  lastAppEvent: "",
};

export const COLOR_ARRAY = Array.from(TL_COLOR_TYPES).reverse();
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 64;
export const MAX_WIDTH = "400px";

export const DEFAULT_STYLE_PROPS = {
  ...TEXT_PROPS,
  fontSize: FONT_SIZES.m,
  fontFamily: FONT_FAMILIES.sans,
  width: "fit-content",
  padding: "40px",
};

const TldrawCanvas = ({ title }: Props) => {
  const allRelations = useMemo(() => {
    const relations = getDiscourseRelations();
    discourseContext.relations = relations.reduce(
      (acc, r) => {
        if (acc[r.label]) {
          acc[r.label].push(r);
        } else {
          acc[r.label] = [r];
        }
        return acc;
      },
      {} as Record<string, DiscourseRelation[]>,
    );
    return relations;
  }, []);
  const allRelationsById = useMemo(() => {
    return Object.fromEntries(allRelations.map((r) => [r.id, r])) as Record<
      string,
      DiscourseRelation
    >;
  }, [allRelations]);
  const allRelationIds = useMemo(() => {
    return Object.keys(allRelationsById);
  }, [allRelationsById]);
  const allRelationNames = useMemo(() => {
    return Object.keys(discourseContext.relations);
  }, [allRelations]);
  const allNodes = useMemo(() => {
    const allNodes = getDiscourseNodes(allRelations);
    discourseContext.nodes = Object.fromEntries(
      allNodes.map((n, index) => [n.type, { ...n, index }]),
    );
    return allNodes;
  }, [allRelations]);
  const isCustomArrowShape = (shape: TLShape) => {
    // TODO: find a better way to identify custom arrow shapes
    // shape.type or shape.name probably?
    const allRelationIdSet = new Set(allRelationIds);
    const allAddReferencedNodeActionsSet = new Set(allAddReferencedNodeActions);

    return (
      allRelationIdSet.has(shape.type) ||
      allAddReferencedNodeActionsSet.has(shape.type)
    );
  };

  const allAddReferencedNodeByAction = useMemo(() => {
    const obj: AddReferencedNodeType = {};

    // TODO: support multiple referenced node
    // with migration from format to specification
    allNodes.forEach((n) => {
      const referencedNodes = [...n.format.matchAll(/{([\w\d-]+)}/g)].filter(
        (match) => match[1] !== "content",
      );

      if (referencedNodes.length > 0) {
        const sourceName = referencedNodes[0][1];
        const sourceType = allNodes.find((node) => node.text === sourceName)
          ?.type as string;

        if (!obj[`Add ${sourceName}`]) obj[`Add ${sourceName}`] = [];

        obj[`Add ${sourceName}`].push({
          format: n.format,
          sourceName,
          sourceType,
          destinationType: n.type,
          destinationName: n.text,
        });
      }
    });

    return obj;
  }, [allNodes]);
  const allAddReferencedNodeActions = useMemo(() => {
    return Object.keys(allAddReferencedNodeByAction);
  }, [allAddReferencedNodeByAction]);

  const extensionAPI = useExtensionAPI();
  if (!extensionAPI) {
    renderToast({
      id: "tldraw-error",
      intent: "danger",
      content: "Extension API not available",
    });
    return <></>;
  }

  const isBindingType = (
    binding: TLArrowTerminal,
  ): binding is TLArrowTerminal & {
    boundShapeId: TLShapeId;
  } => {
    return binding.type === "binding" && !!binding.boundShapeId;
  };
  const hasValidBindings = (bindings: TLArrowTerminal[]) => {
    return bindings.every(isBindingType);
  };
  const compareBindings = (a: TLArrowTerminal, b: TLArrowTerminal) => {
    if (isBindingType(a) && isBindingType(b)) {
      return a.boundShapeId === b.boundShapeId;
    }
    return false;
  };
  type CancelAndWarnType = {
    content: string;
    shape: TLShape;
    context: Translating | DraggingHandle;
  };
  const cancelAndWarn = ({ content, shape, context }: CancelAndWarnType) => {
    renderToast({
      id: "tldraw-warning",
      intent: "warning",
      content,
    });
    context.app.updateShapes([
      {
        id: shape.id,
        type: shape.type,
        props: {
          ...context.info.shape.props,
        },
      },
    ]);
  };

  const customTldrawConfig = useMemo(
    () =>
      new TldrawEditorConfig({
        tools: allNodes
          .map(
            (n): StateNodeConstructor =>
              class extends TLBoxTool {
                static id = n.type;
                static initial = "idle";
                shapeType = n.type;
                override styles = ["opacity" as const];
              },
          )
          .concat(
            allRelationNames.map(
              (name) =>
                class extends TLArrowTool {
                  static id = name;
                  static initial = "idle";
                  static children: typeof TLArrowTool.children = () => {
                    const [Idle, Pointing] = TLArrowTool.children();
                    return [
                      class extends Idle {
                        override onPointerDown: TLPointerEvent = (info) => {
                          const cancelAndWarn = (content: string) => {
                            renderToast({
                              id: "tldraw-warning",
                              intent: "warning",
                              content,
                            });
                            this.onCancel();
                          };
                          if (info.target !== "shape") {
                            return cancelAndWarn("Must start on a node.");
                          }
                          const relation = discourseContext.relations[
                            name
                          ].find((r) => r.source === info.shape.type);
                          if (!relation) {
                            return cancelAndWarn(
                              `Starting node must be one of ${discourseContext.relations[
                                name
                              ]
                                .map(
                                  (r) => discourseContext.nodes[r.source].text,
                                )
                                .join(", ")}`,
                            );
                          } else {
                            (this.parent as TLArrowTool).shapeType =
                              relation.id;
                          }
                          this.parent.transition("pointing", info);
                        };
                      },
                      Pointing,
                    ];
                  };
                  shapeType = name;
                  override styles = ["opacity" as const];
                },
            ),
          )
          .concat(
            Object.keys(allAddReferencedNodeByAction).map(
              (action) =>
                class extends TLArrowTool {
                  static id = `${action}` as string;
                  static initial = "idle";
                  static children: typeof TLArrowTool.children = () => {
                    const [Idle, Pointing] = TLArrowTool.children();
                    return [
                      class extends Idle {
                        override onPointerDown: TLPointerEvent = (info) => {
                          const cancelAndWarn = (content: string) => {
                            renderToast({
                              id: "tldraw-warning",
                              intent: "warning",
                              content,
                            });
                            this.onCancel();
                          };
                          if (info.target !== "shape") {
                            return cancelAndWarn("Must start on a node.");
                          }
                          const sourceType =
                            allAddReferencedNodeByAction[action][0].sourceType;
                          const sourceName =
                            allAddReferencedNodeByAction[action][0].sourceName;
                          if (info.shape.type !== sourceType) {
                            return cancelAndWarn(
                              `Starting node must be one of ${sourceName}`,
                            );
                          } else {
                            (this.parent as TLArrowTool).shapeType =
                              `${action}`;
                          }
                          this.parent.transition("pointing", info);
                        };
                      },
                      Pointing,
                    ];
                  };
                  shapeType = `${action}`;
                  override styles = ["opacity" as const];
                },
            ),
          )
          .concat([
            class extends TLSelectTool {
              // @ts-ignore
              static children: typeof TLSelectTool.children = () => {
                return TLSelectTool.children().map((c) => {
                  if (c.id === "translating") {
                    const Translate = c as unknown as typeof Translating;
                    return class extends Translate {
                      override onPointerUp: TLPointerEvent = () => {
                        this.onComplete({
                          type: "misc",
                          name: "complete",
                        });
                        const shape = this.app.getShapeById(
                          this.info.shape?.id, // sometimes undefined?
                        );
                        if (!shape) return;
                        if (!isCustomArrowShape(shape)) return;

                        // Stop accidental arrow reposition
                        const { start, end } = shape.props as TLArrowShapeProps;
                        const { end: thisEnd, start: thisStart } = this.info
                          .shape.props as TLArrowShapeProps;
                        const hasPreviousBinding = hasValidBindings([
                          thisEnd,
                          thisStart,
                        ]);
                        const bindingsMatchPrevBindings =
                          compareBindings(thisEnd, end) &&
                          compareBindings(thisStart, start);
                        if (hasPreviousBinding && !bindingsMatchPrevBindings) {
                          return cancelAndWarn({
                            content: "Cannot move relation.",
                            shape,
                            context: this,
                          });
                        }
                      };
                    };
                  }

                  if (c.id === "dragging_handle") {
                    const Handle = c as unknown as typeof DraggingHandle;
                    const allRelationIdSet = new Set(allRelationIds);
                    const allAddReferencedNodeActionsSet = new Set(
                      allAddReferencedNodeActions,
                    );
                    return class extends Handle {
                      override onPointerUp: TLPointerEvent = async () => {
                        this.onComplete({
                          type: "misc",
                          name: "complete",
                        });

                        const shape = this.app.getShapeById(this.shapeId);
                        if (!shape) return;
                        if (!isCustomArrowShape(shape)) return;
                        const arrow = shape;
                        const {
                          start,
                          end,
                          text: arrowText,
                        } = arrow.props as TLArrowShapeProps;

                        const deleteAndWarn = (content: string) => {
                          renderToast({
                            id: "tldraw-warning",
                            intent: "warning",
                            content,
                          });
                          this.app.deleteShapes([arrow.id]);
                        };

                        // Allow arrow bend
                        if (this.info.handle.id === "middle") return;

                        // Stop accidental handle removal
                        const { end: thisEnd, start: thisStart } =
                          this.info.shape.props;
                        const hasPreviousBindings = hasValidBindings([
                          thisEnd,
                          thisStart,
                        ]);
                        const bindingsMatchPrevBindings =
                          compareBindings(thisEnd, end) &&
                          compareBindings(thisStart, start);
                        if (hasPreviousBindings && !bindingsMatchPrevBindings) {
                          return cancelAndWarn({
                            content: "Cannot remove handle.",
                            shape,
                            context: this,
                          });
                        }

                        // Allow handles to be repositioned in same shape
                        if (hasPreviousBindings && bindingsMatchPrevBindings) {
                          return;
                        }

                        if (
                          start.type !== "binding" ||
                          end.type !== "binding"
                        ) {
                          return deleteAndWarn(
                            "Relation must connect two nodes.",
                          );
                        }
                        const source = this.app.getShapeById(
                          start.boundShapeId,
                        ) as DiscourseNodeShape;
                        if (!source) {
                          return deleteAndWarn("Failed to find source node.");
                        }
                        const target = this.app.getShapeById(
                          end.boundShapeId,
                        ) as DiscourseNodeShape;
                        if (!target) {
                          return deleteAndWarn("Failed to find target node.");
                        }

                        // Handle "Add Referenced Node" Arrows
                        if (allAddReferencedNodeActionsSet.has(arrow.type)) {
                          const possibleTargets = allAddReferencedNodeByAction[
                            arrow.type
                          ].map((action) => action.destinationType);
                          if (!possibleTargets.includes(target.type)) {
                            return deleteAndWarn(
                              `Target node must be of type ${possibleTargets
                                .map((t) => discourseContext.nodes[t].text)
                                .join(", ")}`,
                            );
                          }

                          // source and target are expected to be pages
                          // TODO: support blocks
                          const targetTitle = target.props.title;
                          const sourceTitle = source.props.title;
                          const isTargetTitleCurrent =
                            getPageTitleByPageUid(target.props.uid).trim() ===
                            targetTitle.trim();
                          const isSourceTitleCurrent =
                            getPageTitleByPageUid(source.props.uid).trim() ===
                            sourceTitle.trim();
                          if (!isTargetTitleCurrent || !isSourceTitleCurrent) {
                            return deleteAndWarn(
                              "Either the source or target node has been renamed. Please update the nodes and try again.",
                            );
                          }

                          // Hack for default shipped EVD format: [[EVD]] - {content} - {Source},
                          // replace when migrating from format to specification
                          let newTitle: string;
                          if (targetTitle.endsWith(" - ")) {
                            newTitle = `${targetTitle}[[${sourceTitle}]]`;
                          } else if (targetTitle.endsWith(" -")) {
                            newTitle = `${targetTitle} [[${sourceTitle}]]`;
                          } else {
                            newTitle = `${targetTitle} - [[${sourceTitle}]]`;
                          }

                          if (!extensionAPI) {
                            return deleteAndWarn(
                              `Failed to update node title.`,
                            );
                          }

                          await window.roamAlphaAPI.data.page.update({
                            page: {
                              uid: target.props.uid,
                              title: newTitle,
                            },
                          });
                          const { h, w, imageUrl } =
                            await calcCanvasNodeSizeAndImg({
                              nodeText: newTitle,
                              uid: target.props.uid,
                              nodeType: target.type,
                              extensionAPI,
                            });
                          this.app.updateShapes([
                            {
                              id: target.id,
                              type: target.type,
                              props: {
                                h,
                                w,
                                imageUrl,
                                title: newTitle,
                              },
                            },
                          ]);

                          renderToast({
                            id: "tldraw-success",
                            intent: "success",
                            content: `Updated node title.`,
                          });

                          return;
                        }

                        // Handle "Add Relationship Arrows"
                        if (allRelationIdSet.has(arrow.type)) {
                          const relation = allRelationsById[arrow.type];
                          if (!relation) return;
                          const sourceLabel =
                            discourseContext.nodes[relation.source].text;
                          if (source.type !== relation.source) {
                            return deleteAndWarn(
                              `Source node must be of type ${sourceLabel}`,
                            );
                          }
                          const possibleTargets = discourseContext.relations[
                            relation.label
                          ]
                            .filter((r) => r.source === relation.source)
                            .map((r) => r.destination);
                          if (!possibleTargets.includes(target.type)) {
                            return deleteAndWarn(
                              `Target node must be of type ${possibleTargets
                                .map((t) => discourseContext.nodes[t].text)
                                .join(", ")}`,
                            );
                          }
                          if (arrow.type !== target.type) {
                            this.app.updateShapes([
                              {
                                id: arrow.id,
                                type: target.type,
                              },
                            ]);
                          }
                          const {
                            triples,
                            label: relationLabel,
                            // complement,
                          } = relation;
                          const isOriginal = arrowText === relationLabel;
                          const newTriples = triples
                            .map((t) => {
                              if (/is a/i.test(t[1])) {
                                const targetNode =
                                  (t[2] === "source" && isOriginal) ||
                                  (t[2] === "destination" && !isOriginal)
                                    ? source
                                    : target;
                                const { uid } =
                                  targetNode.props as DiscourseNodeShape["props"];
                                return [
                                  t[0],
                                  isPageUid(uid) ? "has title" : "with uid",
                                  isPageUid(uid)
                                    ? getPageTitleByPageUid(uid)
                                    : uid,
                                ];
                              }
                              return t.slice(0);
                            })
                            .map(([source, relation, target]) => ({
                              source,
                              relation,
                              target,
                            }));
                          posthog.capture("Canvas Relation: Created", {
                            relation: relationLabel,
                          });
                          triplesToBlocks({
                            defaultPageTitle: `Auto generated from ${title}`,
                            toPage: async (
                              title: string,
                              blocks: InputTextNode[],
                            ) => {
                              const parentUid =
                                getPageUidByPageTitle(title) ||
                                (await createPage({
                                  title: title,
                                }));

                              await Promise.all(
                                blocks.map((node, order) =>
                                  createBlock({ node, order, parentUid }).catch(
                                    () =>
                                      console.error(
                                        `Failed to create block: ${JSON.stringify(
                                          { node, order, parentUid },
                                          null,
                                          4,
                                        )}`,
                                      ),
                                  ),
                                ),
                              );
                              await openBlockInSidebar(parentUid);
                            },
                            nodeSpecificationsByLabel: Object.fromEntries(
                              Object.values(discourseContext.nodes).map((n) => [
                                n.text,
                                n.specification,
                              ]),
                            ),
                          })(newTriples)();
                        }
                      };
                    };
                  }
                  return c;
                });
              };
            },
          ]),
        shapes: [
          ...allNodes.map((n) =>
            defineShape<DiscourseNodeShape>({
              type: n.type,
              getShapeUtil: () =>
                class extends DiscourseNodeUtil {
                  constructor(app: TldrawApp) {
                    super(app, n.type);
                  }
                },
            }),
          ),
          ...allRelationIds.map((id) =>
            defineShape<DiscourseRelationShape>({
              type: id,
              getShapeUtil: () =>
                class extends DiscourseRelationUtil {
                  constructor(app: TldrawApp) {
                    super(app, id);
                  }
                },
            }),
          ),
          ...allAddReferencedNodeActions.map((action) =>
            defineShape<DiscourseReferencedNodeShape>({
              type: action,
              getShapeUtil: () =>
                class extends DiscourseReferencedNodeUtil {
                  constructor(app: TldrawApp) {
                    super(app, action);
                  }
                },
            }),
          ),
        ],
        allowUnknownShapes: true,
      }),
    [allNodes, allRelationIds, allRelationsById, allAddReferencedNodeActions],
  );
  const appRef = useRef<TldrawApp>();
  const lastInsertRef = useRef<Vec2dModel>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);
  const { store, instanceId, userId } = useRoamStore({
    config: customTldrawConfig,
    title,
  });

  // Handle actions (roamjs:query-builder:action)
  useEffect(() => {
    const handleCreateShapeAction = ({
      uid,
      val,
      onRefresh,
    }: {
      uid: string;
      val: string;
      onRefresh: () => void;
    }) => {
      const app = appRef.current;
      if (!app) return;
      const { x, y } = app.pageCenter;
      const { w, h } = app.pageBounds;
      const lastTime = lastInsertRef.current;
      const position = lastTime
        ? {
            x: lastTime.x + w * 0.025,
            y: lastTime.y + h * 0.05,
          }
        : { x: x - DEFAULT_WIDTH / 2, y: y - DEFAULT_HEIGHT / 2 };
      const nodeType = findDiscourseNode(uid, allNodes);
      if (nodeType) {
        app.createShapes([
          {
            type: nodeType.type,
            id: createShapeId(),
            props: {
              uid,
              title: val,
            },
            ...position,
          },
        ]);
        lastInsertRef.current = position;
        onRefresh();
      }
    };
    const handleMoveCameraToShapeAction = ({
      shapeId,
    }: {
      shapeId: TLShapeId;
    }) => {
      const app = appRef.current;
      if (!app) return;
      const shape = app.getShapeById(shapeId);
      if (!shape) {
        return renderToast({
          id: "tldraw-warning",
          intent: "warning",
          content: `Shape not found.`,
        });
      }
      const x = shape?.x || 0;
      const y = shape?.y || 0;
      app.centerOnPoint(x, y, { duration: 500, easing: (t) => t * t });
      app.select(shapeId);
    };
    const actionListener = ((
      e: CustomEvent<{
        action: string;
        uid?: string;
        val?: string;
        shapeId?: TLShapeId;
        onRefresh?: () => void;
      }>,
    ) => {
      if (e.detail.action === "move-camera-to-shape") {
        if (!e.detail.shapeId) return;
        handleMoveCameraToShapeAction({ shapeId: e.detail.shapeId });
      }
      if (/canvas/i.test(e.detail.action)) {
        if (!e.detail.uid || !e.detail.val || !e.detail.onRefresh) return;
        handleCreateShapeAction({
          uid: e.detail.uid,
          val: e.detail.val,
          onRefresh: e.detail.onRefresh,
        });
      }
    }) as EventListener;
    document.addEventListener("roamjs:query-builder:action", actionListener);
    return () => {
      document.removeEventListener(
        "roamjs:query-builder:action",
        actionListener,
      );
    };
  }, [appRef, allNodes]);

  const uiOverrides = createUiOverrides({
    allNodes,
    allRelationNames,
    allAddReferencedNodeByAction,
    appRef,
    extensionAPI,
    maximized,
    setMaximized,
  });

  // Catch a custom event we used patch-package to add
  useEffect(() => {
    const handleTldrawError = (e: CustomEvent<Error>) => {
      sendErrorEmail({
        error: e.detail,
        type: "Tldraw Error",
        context: {
          title,
          user: getCurrentUserDisplayName(),
        },
      }).catch(() => {});

      console.error("Tldraw Error:", e.detail);
    };

    document.addEventListener(
      "tldraw:error",
      handleTldrawError as EventListener,
    );

    return () => {
      document.removeEventListener(
        "tldraw:error",
        handleTldrawError as EventListener,
      );
    };
  }, []);

  return (
    <div
      className={`z-10 h-full w-full overflow-hidden rounded-md border border-gray-300 bg-white ${
        maximized ? "absolute inset-0" : "relative"
      }`}
      id={`roamjs-tldraw-canvas-container`}
      ref={containerRef}
      tabIndex={-1}
    >
      <style>
        {`.roam-article .rm-block-children {
        display: none;
      }
      .rs-arrow-label__inner{
        min-width: initial;
      }
      kbd.tlui-kbd {
        background-color: initial;
        box-shadow: initial;
        border-radius: initial;
        padding: initial;
      }${
        maximized
          ? "div.roam-body div.roam-app div.roam-main div.roam-article { position: inherit; }"
          : ""
      }
      #roamjs-tldraw-canvas-container .rs-shape .roamjs-tldraw-node .rm-block-main .rm-block-separator {
        display: none;
      }
      /* arrow label line fix */
      /* seems like width is being miscalculted cause letters to linebreak */
      /* TODO: this is a temporary fix */
      /* also Roam is hijacking the font choice */
      .rs-arrow-label .rs-arrow-label__inner p {
        padding: 0;
        white-space: nowrap;
        font-family: var(--rs-font-sans);
      }`}
      </style>
      <TldrawEditor
        baseUrl="https://samepage.network/assets/tldraw/"
        instanceId={instanceId}
        userId={userId}
        config={customTldrawConfig}
        store={store}
        onMount={(app) => {
          if (process.env.NODE_ENV !== "production") {
            if (!window.tldrawApps) window.tldrawApps = {};
            const { tldrawApps } = window;
            tldrawApps[title] = app;
          }
          appRef.current = app;
          posthog.capture("Canvas: Mounted", {
            title: title,
          });
          // TODO - this should move to one of DiscourseNodeTool's children classes instead
          app.on("event", (e) => {
            setTimeout(() => {}, 500); // TEMP HACK for useSyncExternalStore error
            discourseContext.lastAppEvent = e.name;

            const validModifier = e.shiftKey || e.ctrlKey || e.metaKey;
            if (!(e.name === "pointer_up" && e.shape && validModifier)) return;
            if (app.selectedIds.length) return; // User is positioning selected shape

            const shapeUid = e.shape?.props.uid;
            if (!isLiveBlock(shapeUid)) {
              if (!e.shape.props.title) return;
              renderToast({
                id: "tldraw-warning",
                intent: "warning",
                content: `Not a valid UID. Cannot Open.`,
              });
            }

            if (e.shiftKey) {
              // TODO - do not openBlockInSidebar if user is using shift to select
              openBlockInSidebar(e.shape.props.uid);
            }
            if (e.ctrlKey || e.metaKey) {
              const isPage = !!getPageTitleByPageUid(shapeUid);
              if (isPage) {
                window.roamAlphaAPI.ui.mainWindow.openPage({
                  page: { uid: shapeUid },
                });
              } else {
                window.roamAlphaAPI.ui.mainWindow.openBlock({
                  block: { uid: shapeUid },
                });
              }
            }
          });
          const oldOnBeforeDelete = app.store.onBeforeDelete;
          app.store.onBeforeDelete = (record) => {
            oldOnBeforeDelete?.(record);
            if (record.typeName === "shape") {
              const util = app.getShapeUtil(record);
              if (util instanceof DiscourseNodeUtil) {
                util.onBeforeDelete(record as DiscourseNodeShape);
              }
            }
          };
          const oldOnAfterCreate = app.store.onAfterCreate;
          app.store.onAfterCreate = (record) => {
            oldOnAfterCreate?.(record);
            if (record.typeName === "shape") {
              const util = app.getShapeUtil(record);
              if (util instanceof DiscourseNodeUtil) {
                util.onAfterCreate(record as DiscourseNodeShape);
              }
            }
          };
        }}
      >
        <TldrawUi
          assetBaseUrl="https://samepage.network/assets/tldraw/"
          overrides={uiOverrides}
        >
          <ContextMenu>
            <Canvas />
          </ContextMenu>
        </TldrawUi>
      </TldrawEditor>
    </div>
  );
};

export const renderTldrawCanvas = ({
  title,
  onloadArgs,
}: {
  title: string;
  onloadArgs: OnloadArgs;
}) => {
  const children = document.querySelector<HTMLDivElement>(
    ".roam-article .rm-block-children",
  );
  if (
    children &&
    children.parentElement &&
    !children.hasAttribute("data-roamjs-discourse-canvas")
  ) {
    children.setAttribute("data-roamjs-discourse-canvas", "true");
    const parent = document.createElement("div");
    children.parentElement.appendChild(parent);
    parent.style.height = "500px";
    parent.style.height = "70vh";
    renderWithUnmount(
      <ExtensionApiContextProvider {...onloadArgs}>
        <TldrawCanvas title={title} previewEnabled={isFlagEnabled("preview")} />
      </ExtensionApiContextProvider>,
      parent,
    );
  }
};

export default TldrawCanvas;
