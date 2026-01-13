import {
  ShapeUtil,
  Rectangle2d,
  HTMLContainer,
  TLBaseShape,
  useEditor,
  DefaultColorStyle,
  Editor,
  TLOnResizeHandler,
  resizeBox,
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
  TLDefaultFontStyle,
  DefaultFontStyle,
  toDomPrecision,
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
import { discourseContext } from "./Tldraw";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import { createTextJsxFromSpans } from "./DiscourseRelationShape/helpers";
import { loadImage } from "~/utils/loadImage";
import { getRelationColor } from "./DiscourseRelationShape/DiscourseRelationUtil";
import {
  AUTO_CANVAS_RELATIONS_KEY,
  DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY,
} from "~/data/userSettings";
import { getSetting } from "~/utils/extensionSettings";
import DiscourseContextOverlay from "~/components/DiscourseContextOverlay";
import { getDiscourseNodeColors } from "~/utils/getDiscourseNodeColors";
import { render as renderToast } from "roamjs-components/components/Toast";

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
/* eslint-disable @typescript-eslint/naming-convention */
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
/* eslint-disable @typescript-eslint/naming-convention */

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
      shapeType = n.type;

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
          type: this.shapeType,
          x: currentPagePoint.x,
          y: currentPagePoint.y,
          props: { fontFamily: "sans", size: "s" },
        });
        this.editor.setEditingShape(shapeId);
        this.editor.setCurrentTool("select");
      };
    };
  });
};

export const createNodeShapeUtils = (nodes: DiscourseNode[]) => {
  return nodes.map((node) => {
    class DiscourseNodeUtil extends BaseDiscourseNodeUtil {
      constructor(editor: Editor) {
        super(editor, node.type);
      }
      static override type = node.type; // removing this gives undefined error
      // getDefaultProps(): DiscourseNodeShape["props"] {
      //   const baseProps = super.getDefaultProps();
      //   return {
      //     ...baseProps,
      //     color: node.color,
      //   };
      // }
    }
    return DiscourseNodeUtil;
  });
};

export type DiscourseNodeShape = TLBaseShape<
  string,
  {
    w: number;
    h: number;
    // opacity: TLOpacityType;
    uid: string;
    title: string;
    imageUrl?: string;
    size: TLDefaultSizeStyle;
    fontFamily: TLDefaultFontStyle;
  }
>;
export class BaseDiscourseNodeUtil extends ShapeUtil<DiscourseNodeShape> {
  type: string;

  constructor(editor: Editor, type: string) {
    super(editor);
    this.type = type;
  }

  static override props = {
    w: T.number,
    h: T.number,
    // opacity: T.number,
    uid: T.string,
    title: T.string,
    imageUrl: T.optional(T.string),
    size: DefaultSizeStyle,
    fontFamily: DefaultFontStyle,
  };

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;
  override canEdit = () => true;
  getGeometry(shape: DiscourseNodeShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      // opacity: "1" as DiscourseNodeShape["props"]["opacity"],
      w: 160,
      h: 64,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
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
    const bindingsToThisShape = Array.from(relationIds).flatMap((r) =>
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
          return r.typeName === "shape" && nodeIds.has(r.type);
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
    const currentShapeRelations = Array.from(
      discourseContextRelationIds,
    ).flatMap((relationId) => {
      const bindingsToThisShape = editor.getBindingsToShape(
        shape.id,
        relationId,
      );
      return bindingsToThisShape.map((b) => {
        const arrowId = b.fromId;
        const bindingsFromArrow = editor.getBindingsFromShape(
          arrowId,
          relationId,
        );
        const endBinding = bindingsFromArrow.find((b) => b.toId !== shape.id);
        if (!endBinding) return null;
        return { startId: shape.id, endId: endBinding.toId };
      });
    });

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
      .filter(({ complement, nodeId }) => {
        const startId = complement ? nodesInCanvas[nodeId].id : shape.id;
        const endId = complement ? shape.id : nodesInCanvas[nodeId].id;
        const relationAlreadyExists = currentShapeRelations.some((r) => {
          return complement
            ? r?.startId === endId && r?.endId === startId
            : r?.startId === startId && r?.endId === endId;
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
        return { id: arrowId, type: relationId, props: { color } };
      },
    );

    const bindingsToCreate = toCreate.flatMap(
      ({ relationId, complement, nodeId, arrowId }) => {
        const staticRelationProps = { type: relationId, fromId: arrowId };
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

  getColors() {
    return getDiscourseNodeColors({ nodeType: this.type });
  }

  async toSvg(shape: DiscourseNodeShape): Promise<JSX.Element> {
    const { backgroundColor, textColor } = this.getColors();
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

  override onResize: TLOnResizeHandler<DiscourseNodeShape> = (shape, info) => {
    return resizeBox(shape, info);
  };

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
    } = discourseContext.nodes[shape.type] || {};
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isOverlayEnabled = useMemo(
      () => getSetting(DISCOURSE_CONTEXT_OVERLAY_IN_CANVAS_KEY, false),
      [],
    );

    const isEditing = this.editor.getEditingShapeId() === shape.id;
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const contentRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [loaded, setLoaded] = useState("");
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [overlayMounted, setOverlayMounted] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const dialogRenderedRef = useRef(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (
        shape.props.uid !== loaded &&
        !isPageUid(shape.props.uid) &&
        contentRef.current &&
        isLiveBlock(shape.props.uid)
      ) {
        window.roamAlphaAPI.ui.components.renderBlock({
          el: contentRef.current,
          uid: shape.props.uid,
        });
        // TODO: resize shape props once this is rendered
        setLoaded(shape.props.uid);
      }
    }, [setLoaded, loaded, contentRef, shape.props.uid]);

    const { backgroundColor, textColor } = this.getColors();

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
            nodeType: this.type,
            extensionAPI,
          });
          this.updateProps(shape.id, shape.type, { h, w, imageUrl });
        };

        renderModifyNodeDialog({
          mode: isCreating ? "create" : "edit",
          nodeType: shape.type,
          initialValue: { text: shape.props.title, uid: shape.props.uid },
          // Only pass it when editing an existing node that has a valid Roam block UID
          sourceBlockUid:
            !isCreating && isLiveBlock(shape.props.uid)
              ? shape.props.uid
              : undefined,
          extensionAPI,
          includeDefaultNodes: true,
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
            });

            const autoCanvasRelations = getSetting<boolean>(
              AUTO_CANVAS_RELATIONS_KEY,
              false,
            );
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

            editor.setEditingShape(null);
            dialogRenderedRef.current = false;
          },
          onClose: () => {
            editor.setEditingShape(null);
            dialogRenderedRef.current = false;
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
        className="roamjs-tldraw-node pointer-events-auto flex items-center justify-center overflow-hidden rounded-2xl"
        style={{
          background: backgroundColor,
          color: textColor,
        }}
        onPointerEnter={() => setOverlayMounted(true)}
      >
        <div style={{ pointerEvents: "all" }}>
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

          {shape.props.imageUrl && isKeyImage === "true" ? (
            <img
              src={shape.props.imageUrl}
              className="h-auto w-full object-cover"
              draggable="false"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          <div
            ref={contentRef}
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
            {alias
              ? new RegExp(alias).exec(shape.props.title)?.[1] ||
                shape.props.title
              : shape.props.title}
          </div>
        </div>
      </HTMLContainer>
    );
  }
}
