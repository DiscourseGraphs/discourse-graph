import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  useEditor,
  DefaultColorStyle,
  createShapeId,
  TLDefaultHorizontalAlignStyle,
  TLDefaultVerticalAlignStyle,
  Box,
  FileHelpers,
  StateNode,
  TLStateNodeConstructor,
  TLDefaultSizeStyle,
  DefaultSizeStyle,
  T,
  FONT_FAMILIES,
  TLShape,
  TLDefaultFontStyle,
  DefaultFontStyle,
  toDomPrecision,
  TLAnyShapeUtilConstructor,
} from "tldraw";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { Button, Icon } from "@blueprintjs/core";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import { isPageUid } from "./Tldraw";
import { renderModifyNodeDialog } from "~/components/ModifyNodeDialog";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { getCleanTagText } from "~/components/settings/NodeConfig";
import { discourseContext } from "./Tldraw";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { createTextJsxFromSpans } from "./DiscourseRelationShape/helpers";
import { loadImage } from "~/utils/loadImage";
import {
  DISCOURSE_RELATION_SHAPE_TYPE,
  getDiscourseRelationTypeId,
  getRelationColor,
  isDiscourseRelationShape,
} from "./DiscourseRelationShape/DiscourseRelationUtil";
import { getPersonalSetting } from "~/components/settings/utils/accessors";
import { PERSONAL_KEYS } from "~/components/settings/utils/settingKeys";
import DiscourseContextOverlay from "~/components/DiscourseContextOverlay";
import { getDiscourseNodeColors } from "~/utils/getDiscourseNodeColors";
import { render as renderToast } from "roamjs-components/components/Toast";
import { RenderRoamBlockString } from "~/utils/roamReactComponents";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// TODO REPLACE WITH TLDRAW DEFAULTS
// https://github.com/tldraw/tldraw/pull/1580/files
const TEXT_PROPS = {
  lineHeight: 1.35,
  fontWeight: "normal",
  fontVariant: "normal",
  fontStyle: "normal",
  padding: "0px",
  maxWidth: "auto",
};
export const FONT_SIZES: Record<TLDefaultSizeStyle, number> = {
  m: 25,
  l: 38,
  xl: 48,
  s: 16,
};
// // FONT_FAMILIES.sans or tldraw_sans not working in toSvg()
// // maybe check getSvg()
// // in node_modules\@tldraw\tldraw\node_modules\@tldraw\editor\dist\cjs\lib\app\App.js
// const SVG_FONT_FAMILY = `"Inter", "sans-serif"`;

export const DEFAULT_STYLE_PROPS = {
  ...TEXT_PROPS,
  fontSize: 16,
  fontFamily: "'Inter', sans-serif",
  width: "fit-content",
  padding: "40px",
};
export const COLOR_ARRAY = Array.from(DefaultColorStyle.values).reverse();
// from @tldraw/editor/editor.css
export const COLOR_PALETTE: Record<string, string> = {
  black: "#1d1d1d",
  blue: "#4263eb",
  green: "#099268",
  grey: "#adb5bd",
  "light-blue": "#4dabf7",
  "light-green": "#40c057",
  "light-red": "#ff8787",
  "light-violet": "#e599f7",
  orange: "#f76707",
  red: "#e03131",
  violet: "#ae3ec9",
  white: "#ffffff",
  yellow: "#ffc078",
};

export const DISCOURSE_NODE_SHAPE_TYPE = "discourse-node";

const getRelationIds = () =>
  new Set(
    Object.values(discourseContext.relations).flatMap((rs) =>
      rs.map((r) => r.id),
    ),
  );

export const createNodeShapeTools = (
  nodes: DiscourseNode[],
): TLStateNodeConstructor[] => {
  return nodes.map((n) => {
    return class DiscourseNodeTool extends StateNode {
      static id = n.type;
      static initial = "idle";
      static isLockable = true;
      nodeTypeId = n.type;

      override onEnter = () => {
        this.editor.setCursor({
          type: "cross",
          rotation: 45,
        });
      };

      override onPointerDown = () => {
        const { currentPagePoint } = this.editor.inputs;
        const shapeId = createShapeId();
        this.editor.createShape({
          id: shapeId,
          type: DISCOURSE_NODE_SHAPE_TYPE,
          x: currentPagePoint.x,
          y: currentPagePoint.y,
          props: {
            fontFamily: "sans",
            size: "s",
            nodeTypeId: this.nodeTypeId,
          },
        });
        this.editor.setEditingShape(shapeId);
      };
    };
  });
};

type ShapeWithOptionalNodeTypeId = TLShape & {
  props?: {
    nodeTypeId?: string;
  };
};

export const getDiscourseNodeTypeId = ({
  shape,
}: {
  shape: ShapeWithOptionalNodeTypeId;
}): string => {
  return shape.props?.nodeTypeId || shape.type;
};

export const isDiscourseNodeShape = (
  shape: TLShape,
): shape is DiscourseNodeShape => {
  return (
    shape.type === DISCOURSE_NODE_SHAPE_TYPE ||
    !!discourseContext.nodes[shape.type]
  );
};

export type DiscourseNodeShape = TLBaseShape<
  string,
  {
    w: number;
    h: number;
    // opacity: TLOpacityType;
    uid: string;
    title: string;
    nodeTypeId?: string;
    imageUrl?: string;
    size: TLDefaultSizeStyle;
    fontFamily: TLDefaultFontStyle;
  }
>;
export class DiscourseNodeUtil extends BaseBoxShapeUtil<DiscourseNodeShape> {
  static override type = DISCOURSE_NODE_SHAPE_TYPE;

  static override props = {
    w: T.number,
    h: T.number,
    // opacity: T.number,
    uid: T.string,
    title: T.string,
    nodeTypeId: T.string,
    imageUrl: T.optional(T.string),
    size: DefaultSizeStyle,
    fontFamily: DefaultFontStyle,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;
  override canEdit = () => true;
  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      // opacity: "1" as DiscourseNodeShape["props"]["opacity"],
      w: 160,
      h: 64,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
      nodeTypeId: "",
      size: "s",
      fontFamily: "sans",
    };
  }

  deleteRelationsInCanvas({
    shape,
    relationIds = getRelationIds(),
  }: {
    shape: DiscourseNodeShape;
    relationIds?: Set<string>;
  }) {
    const editor = this.editor;
    const relationBindingTypes = new Set([
      DISCOURSE_RELATION_SHAPE_TYPE,
      ...relationIds,
    ]);
    const bindingsToThisShape = Array.from(relationBindingTypes).flatMap((r) =>
      editor.getBindingsToShape(shape.id, r),
    );
    const relationIdsAndType = bindingsToThisShape.map((b) => {
      return { id: b.fromId, type: b.type };
    });
    const bindingsToDelete = relationIdsAndType.flatMap((r) => {
      return editor.getBindingsFromShape(r.id, r.type);
    });

    const relationIdsToDelete = relationIdsAndType.map((r) => r.id);
    const bindingIdsToDelete = bindingsToDelete.map((b) => b.id);

    editor.deleteShapes(relationIdsToDelete).deleteBindings(bindingIdsToDelete);
  }

  async createExistingRelations({
    shape,
    relationIds = getRelationIds(),
    finalUid = shape.props.uid,
  }: {
    shape: DiscourseNodeShape;
    relationIds?: Set<string>;
    finalUid?: string;
  }) {
    const editor = this.editor;
    const nodes = Object.values(discourseContext.nodes);
    const nodeIds = new Set(nodes.map((n) => n.type));
    const allRecords = editor.store.allRecords();
    const nodesInCanvas = Object.fromEntries(
      allRecords
        .filter((r): r is DiscourseNodeShape => {
          if (r.typeName !== "shape") return false;
          const nodeTypeId = getDiscourseNodeTypeId({ shape: r });
          return (
            r.typeName === "shape" && !!nodeTypeId && nodeIds.has(nodeTypeId)
          );
        })
        .map((r) => [r.props.uid, r] as const),
    );
    const discourseContextResults = await getDiscourseContextResults({
      uid: finalUid,
      nodes: Object.values(discourseContext.nodes),
      relations: Object.values(discourseContext.relations).flat(),
    });
    const discourseContextRelationIds = new Set(
      discourseContextResults
        .flatMap((item) =>
          Object.values(item.results).map((result) => result.id),
        )
        .filter((id) => id !== undefined),
    );
    const relationBindingTypes = new Set([
      DISCOURSE_RELATION_SHAPE_TYPE,
      ...discourseContextRelationIds,
    ]);
    const currentShapeRelations = Array.from(relationBindingTypes).flatMap(
      (bindingType) => {
        const bindingsToThisShape = editor.getBindingsToShape(
          shape.id,
          bindingType,
        );
        return bindingsToThisShape.flatMap((bindingToThisShape) => {
          const arrowId = bindingToThisShape.fromId;
          const arrow = editor.getShape(arrowId);
          if (!arrow || !isDiscourseRelationShape(arrow)) return [];

          const bindingsFromArrow = editor.getBindingsFromShape(
            arrowId,
            bindingType,
          );
          const endBinding = bindingsFromArrow.find(
            (bindingFromArrow) => bindingFromArrow.toId !== shape.id,
          );
          if (!endBinding) return [];

          return [
            {
              startId: shape.id,
              endId: endBinding.toId,
              relationTypeId: getDiscourseRelationTypeId({ shape: arrow }),
            },
          ];
        });
      },
    );

    const toCreate = discourseContextResults
      .flatMap((r) =>
        Object.entries(r.results)
          .filter(([k, v]) => nodesInCanvas[k] && v.id && relationIds.has(v.id))
          .map(([k, v]) => {
            return {
              relationId: v.id!,
              complement: v.complement,
              nodeId: k,
              label: r.label,
            };
          }),
      )
      .filter(({ relationId, complement, nodeId }) => {
        const startId = complement ? nodesInCanvas[nodeId].id : shape.id;
        const endId = complement ? shape.id : nodesInCanvas[nodeId].id;
        const relationAlreadyExists = currentShapeRelations.some((r) => {
          if (r.relationTypeId !== relationId) return false;

          return complement
            ? r.startId === endId && r.endId === startId
            : r.startId === startId && r.endId === endId;
        });
        return !relationAlreadyExists;
      })
      .map(({ relationId, complement, nodeId, label }) => {
        const arrowId = createShapeId();
        return { relationId, complement, nodeId, arrowId, label };
      });

    const shapesToCreate = toCreate.map(
      ({ relationId, arrowId, label }, index) => {
        const color = getRelationColor(label, index);
        return {
          id: arrowId,
          type: DISCOURSE_RELATION_SHAPE_TYPE,
          props: {
            color,
            labelColor: color,
            text: label,
            relationTypeId: relationId,
          },
        };
      },
    );

    const bindingsToCreate = toCreate.flatMap(
      ({ complement, nodeId, arrowId }) => {
        const staticRelationProps = {
          type: DISCOURSE_RELATION_SHAPE_TYPE,
          fromId: arrowId,
        };
        return [
          {
            ...staticRelationProps,
            toId: complement ? nodesInCanvas[nodeId].id : shape.id,
            props: { terminal: "start" },
          },
          {
            ...staticRelationProps,
            toId: complement ? shape.id : nodesInCanvas[nodeId].id,
            props: { terminal: "end" },
          },
        ];
      },
    );

    editor.createShapes(shapesToCreate).createBindings(bindingsToCreate);
  }

  getColors(shape: DiscourseNodeShape) {
    return getDiscourseNodeColors({
      nodeType: getDiscourseNodeTypeId({ shape }),
    });
  }

  async toSvg(shape: DiscourseNodeShape): Promise<JSX.Element> {
    const { backgroundColor, textColor } = this.getColors(shape);
    const padding = Number(DEFAULT_STYLE_PROPS.padding.replace("px", ""));
    const props = shape.props;
    const bounds = new Box(0, 0, props.w, props.h);
    const width = Math.ceil(bounds.width);
    const height = Math.ceil(bounds.height);
    const opts = {
      fontSize: DEFAULT_STYLE_PROPS.fontSize,
      fontFamily: DEFAULT_STYLE_PROPS.fontFamily,
      textAlign: "start" as TLDefaultHorizontalAlignStyle,
      verticalTextAlign: "middle" as TLDefaultVerticalAlignStyle,
      width,
      height,
      padding,
      lineHeight: DEFAULT_STYLE_PROPS.lineHeight,
      overflow: "wrap" as const,
      fontWeight: DEFAULT_STYLE_PROPS.fontWeight,
      fontStyle: DEFAULT_STYLE_PROPS.fontStyle,
      fill: textColor,
      text: props.title,
      stroke: "none",
      bounds,
    };

    let offsetY;
    let imageElement = null;
    if (props.imageUrl) {
      // https://github.com/tldraw/tldraw/blob/v2.3.0/packages/tldraw/src/lib/shapes/image/ImageShapeUtil.tsx#L31
      const getDataURIFromURL = async (url: string): Promise<string> => {
        const response = await fetch(url);
        const blob = await response.blob();
        return FileHelpers.blobToDataUrl(blob);
      };
      const src = await getDataURIFromURL(props.imageUrl);
      const { width: imageWidth, height: imageHeight } = await loadImage(src);
      const aspectRatio = imageWidth / imageHeight;
      const svgImageHeight = props.w / aspectRatio;

      offsetY = svgImageHeight / 2;
      imageElement = (
        <image
          xlinkHref={src}
          x="0"
          y="0"
          width={width}
          height={svgImageHeight}
          preserveAspectRatio="xMidYMid slice"
        />
      );
    }

    const spans = this.editor.textMeasure.measureTextSpans(props.title, opts);
    const jsx = createTextJsxFromSpans(this.editor, spans, {
      ...opts,
      offsetY,
    });

    return (
      <g>
        <rect
          width={width}
          height={height}
          fill={backgroundColor}
          opacity={shape.opacity}
          rx={16}
          ry={16}
        />
        {imageElement}
        {jsx}
      </g>
    );
  }

  indicator(shape: DiscourseNodeShape) {
    const { bounds } = this.editor.getShapeGeometry(shape);
    return (
      <rect
        width={toDomPrecision(bounds.width)}
        height={toDomPrecision(bounds.height)}
      />
    );
  }

  updateProps(
    id: DiscourseNodeShape["id"],
    type: DiscourseNodeShape["type"],
    props: Partial<DiscourseNodeShape["props"]>,
  ) {
    this.editor.updateShapes([{ id, props, type }]);
  }
  component(shape: DiscourseNodeShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const editor = useEditor();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const extensionAPI = useExtensionAPI();
    const {
      canvasSettings: { alias = "", "key-image": isKeyImage = "" } = {},
    } = discourseContext.nodes[getDiscourseNodeTypeId({ shape })] || {};
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isOverlayEnabled = useMemo(
      () => getPersonalSetting<boolean>([PERSONAL_KEYS.overlayInCanvas]),
      [],
    );

    const isEditing = this.editor.getEditingShapeId() === shape.id;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [overlayMounted, setOverlayMounted] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const dialogRenderedRef = useRef(false);

    // Detect discourse node tags in block text for blck-node shapes
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const matchedNodeForConversion = useMemo(() => {
      if (getDiscourseNodeTypeId({ shape }) !== "blck-node") return null;
      if (!isLiveBlock(shape.props.uid)) return null;
      const blockText = getTextByBlockUid(shape.props.uid);
      if (!blockText) return null;
      const nodes = Object.values(discourseContext.nodes);
      const tagPattern = /#(?:\[\[([^\]]*)\]\]|([^\s#[\]]+))/g;
      for (const node of nodes) {
        const tag = node.tag;
        if (!tag) continue;
        const normalizedNodeTag = getCleanTagText(tag);
        let match;
        tagPattern.lastIndex = 0;
        while ((match = tagPattern.exec(blockText)) !== null) {
          const tagFromBlock = match[1] ?? match[2] ?? "";
          const normalizedBlockTag = getCleanTagText(tagFromBlock);
          if (normalizedBlockTag === normalizedNodeTag) {
            return { node, blockText };
          }
        }
      }
      return null;
    }, [shape]);

    const { backgroundColor, textColor } = this.getColors(shape);
    const showEmbeddedRoamBlock =
      !isPageUid(shape.props.uid) && isLiveBlock(shape.props.uid);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const isCreating = !isLiveBlock(shape.props.uid);
      if (isEditing && !dialogRenderedRef.current) {
        const setSizeAndImgPropsLocal = async ({
          text,
          uid,
        }: {
          text: string;
          uid: string;
        }) => {
          if (!extensionAPI) return;
          const { h, w, imageUrl } = await calcCanvasNodeSizeAndImg({
            nodeText: text,
            uid,
            nodeType: getDiscourseNodeTypeId({ shape }),
            extensionAPI,
          });
          this.updateProps(shape.id, shape.type, { h, w, imageUrl });
        };

        const wasToolLocked = this.editor.getInstanceState().isToolLocked;

        const restoreToolState = () => {
          if (wasToolLocked) {
            this.editor.updateInstanceState({ isToolLocked: true });
            this.editor.setCurrentTool(getDiscourseNodeTypeId({ shape }));
          } else {
            this.editor.setCurrentTool("select");
          }
          editor.setEditingShape(null);
          dialogRenderedRef.current = false;
        };

        const initialTitle = isCreating
          ? shape.props.title
          : getPageTitleByPageUid(shape.props.uid) ||
            getTextByBlockUid(shape.props.uid) ||
            shape.props.title;

        renderModifyNodeDialog({
          mode: isCreating ? "create" : "edit",
          nodeType: getDiscourseNodeTypeId({ shape }),
          initialValue: { text: initialTitle, uid: shape.props.uid },
          // Only pass it when editing an existing node that has a valid Roam block UID
          sourceBlockUid:
            !isCreating && isLiveBlock(shape.props.uid)
              ? shape.props.uid
              : undefined,
          extensionAPI,
          includeDefaultNodes: true,
          disableNodeTypeChange: true,
          onSuccess: async ({ text, uid, action }) => {
            if (action === "edit") {
              if (isPageUid(shape.props.uid))
                await window.roamAlphaAPI.updatePage({
                  page: { uid: shape.props.uid, title: text },
                });
              else await updateBlock({ uid: shape.props.uid, text });
            }

            // Node creation is handled by ModifyNodeDialog - no fallback needed here

            void setSizeAndImgPropsLocal({ text, uid });
            this.updateProps(shape.id, shape.type, {
              title: text,
              uid,
              nodeTypeId: getDiscourseNodeTypeId({ shape }),
            });

            const autoCanvasRelations = getPersonalSetting<boolean>([
              PERSONAL_KEYS.autoCanvasRelations,
            ]);
            if (autoCanvasRelations) {
              try {
                const relationIds = getRelationIds();
                this.deleteRelationsInCanvas({ shape, relationIds });
                await this.createExistingRelations({
                  shape,
                  relationIds,
                  finalUid: uid,
                });
              } catch (error) {
                renderToast({
                  id: `discourse-node-error-${Date.now()}`,
                  intent: "danger",
                  content: (
                    <span>Error creating relations: {String(error)}</span>
                  ),
                });
              }
            }
          },
          onClose: () => {
            if (isCreating) {
              restoreToolState();
            } else {
              editor.setEditingShape(null);
              dialogRenderedRef.current = false;
            }
          },
        });

        dialogRenderedRef.current = true;
      } else if (!isEditing && dialogRenderedRef.current) {
        dialogRenderedRef.current = false;
      }
    }, [isEditing, shape, editor, extensionAPI]);

    return (
      <HTMLContainer
        id={shape.id}
        className="roamjs-tldraw-node pointer-events-auto flex h-full min-h-0 w-full min-w-0 overflow-hidden rounded-2xl"
        style={{
          background: backgroundColor,
          color: textColor,
          width: shape.props.w,
          height: shape.props.h,
          maxWidth: shape.props.w,
          maxHeight: shape.props.h,
          boxSizing: "border-box",
        }}
        onPointerEnter={() => setOverlayMounted(true)}
      >
        <div
          className="relative flex h-full min-h-0 w-full min-w-0 flex-col"
          style={{ pointerEvents: "all" }}
        >
          {/* Open in Sidebar Button */}
          <Button
            className="absolute left-1 top-1 z-10"
            minimal
            small
            icon={
              <Icon
                icon="panel-stats"
                color={textColor}
                className="opacity-50"
              />
            }
            onClick={(e) => {
              e.stopPropagation();
              void openBlockInSidebar(shape.props.uid);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="Open in sidebar (Shift+Click)"
          />

          {/* Convert to Node Type Button */}
          {matchedNodeForConversion && (
            <Button
              className="absolute left-7 top-1 z-10"
              minimal
              small
              icon={
                <Icon icon="plus" color={textColor} className="opacity-50" />
              }
              onClick={(e) => {
                e.stopPropagation();
                const { node, blockText } = matchedNodeForConversion;
                const tag = node.tag;
                if (!tag) return;
                const cleanTag = getCleanTagText(tag);
                const escapedCleanTag = escapeRegExp(cleanTag);
                // Strip the tag from block text (same pattern as detection above)
                const cleanedText = blockText
                  .replace(
                    new RegExp(`#\\[\\[${escapedCleanTag}\\]\\]`, "i"),
                    "",
                  )
                  .replace(new RegExp(`#${escapedCleanTag}`, "i"), "")
                  .trim();
                const { x, y } = shape;
                renderModifyNodeDialog({
                  mode: "create",
                  nodeType: node.type,
                  initialValue: { text: cleanedText, uid: "" },
                  extensionAPI,
                  includeDefaultNodes: true,
                  disableNodeTypeChange: true,
                  onSuccess: async ({ text, uid }) => {
                    if (!extensionAPI) return;
                    try {
                      const {
                        h,
                        w,
                        imageUrl: nodeImageUrl,
                      } = await calcCanvasNodeSizeAndImg({
                        nodeText: text,
                        extensionAPI,
                        nodeType: node.type,
                        uid,
                      });
                      editor.createShapes([
                        {
                          type: DISCOURSE_NODE_SHAPE_TYPE,
                          id: createShapeId(),
                          props: {
                            uid,
                            title: text,
                            h,
                            w,
                            imageUrl: nodeImageUrl,
                            fontFamily: "sans",
                            size: "s",
                            nodeTypeId: node.type,
                          },
                          x,
                          y,
                        },
                      ]);
                      editor.deleteShapes([shape.id]);
                    } catch (error) {
                      renderToast({
                        id: `discourse-node-convert-error-${Date.now()}`,
                        intent: "danger",
                        content: (
                          <span>Error converting block: {String(error)}</span>
                        ),
                      });
                    }
                  },
                  onClose: () => {},
                });
              }}
              onPointerDown={(e) => e.stopPropagation()}
              title={`Convert to ${matchedNodeForConversion.node.text}`}
            >
              <span
                className="opacity-70"
                style={{ color: textColor, fontSize: "11px" }}
              >
                Convert to {matchedNodeForConversion.node.text}
              </span>
            </Button>
          )}

          {shape.props.imageUrl && isKeyImage === "true" ? (
            <div className="mt-2 flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
              <img
                src={shape.props.imageUrl}
                loading="lazy"
                decoding="async"
                draggable="false"
                className="max-h-full max-w-full object-contain"
                style={{ pointerEvents: "none" }}
              />
            </div>
          ) : null}

          <div
            className="relative"
            style={{
              ...DEFAULT_STYLE_PROPS,
              maxWidth: "",
              fontFamily: FONT_FAMILIES[shape.props.fontFamily],
              fontSize: FONT_SIZES[shape.props.size],
            }}
          >
            {overlayMounted && isOverlayEnabled && (
              <div
                className="roamjs-discourse-context-overlay-container absolute right-1 top-1"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <DiscourseContextOverlay
                  uid={shape.props.uid}
                  id={`${shape.id}-overlay`}
                  opacity="50"
                  textColor={textColor}
                  iconColor={textColor}
                />
              </div>
            )}
            {showEmbeddedRoamBlock ? (
              <div className="w-full min-w-0">
                <RenderRoamBlockString
                  key={shape.props.uid}
                  string={
                    getTextByBlockUid(shape.props.uid) || shape.props.title
                  }
                />
              </div>
            ) : alias ? (
              new RegExp(alias).exec(shape.props.title)?.[1] ||
              shape.props.title
            ) : (
              shape.props.title
            )}
          </div>
        </div>
      </HTMLContainer>
    );
  }
}

export const createLegacyDiscourseNodeShapeUtils = (
  nodes: DiscourseNode[],
): TLAnyShapeUtilConstructor[] => {
  return nodes
    .filter((node) => node.type !== DISCOURSE_NODE_SHAPE_TYPE)
    .map((node) => {
      class LegacyDiscourseNodeUtil extends DiscourseNodeUtil {
        static override type = node.type;
        static override props = {
          ...DiscourseNodeUtil.props,
          nodeTypeId: T.optional(T.string),
        } as typeof DiscourseNodeUtil.props;

        override getDefaultProps(): DiscourseNodeShape["props"] {
          return {
            ...super.getDefaultProps(),
            nodeTypeId: node.type,
          };
        }
      }

      return LegacyDiscourseNodeUtil as TLAnyShapeUtilConstructor;
    });
};
