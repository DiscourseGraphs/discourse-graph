import {
  App as TldrawApp,
  HTMLContainer,
  TLBaseShape,
  TLBoxUtil,
  TLOpacityType,
  TLRecord,
  TLShape,
  createShapeId,
  isShape,
} from "@tldraw/tldraw";
import ContrastColor from "contrast-color";
import React, { useState, useEffect, useRef } from "react";
import { useExtensionAPI } from "roamjs-components/components/ExtensionApiContext";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import isLiveBlock from "roamjs-components/queries/isLiveBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import { useValue } from "signia-react";
import calcCanvasNodeSizeAndImg from "~/utils/calcCanvasNodeSizeAndImg";
import createDiscourseNode from "~/utils/createDiscourseNode";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import { measureCanvasNodeText } from "~/utils/measureCanvasNodeText";
import { COLOR_ARRAY, DEFAULT_STYLE_PROPS, discourseContext } from "./Tldraw";
import LabelDialog from "./LabelDialog";
import { isPageUid } from "~/utils/isPageUid";
import { loadImage } from "~/utils/loadImage";
import { DiscourseRelationShape } from "./DiscourseRelationsUtil";
import { formatHexColor } from "../settings/DiscourseNodeCanvasSettings";

// from @tldraw/editor/editor.css
const COLOR_PALETTE: Record<string, string> = {
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

// FONT_FAMILIES.sans or tldraw_sans not working in toSvg()
// maybe check getSvg()
// in node_modules\@tldraw\tldraw\node_modules\@tldraw\editor\dist\cjs\lib\app\App.js
const SVG_FONT_FAMILY = "sans-serif";

export type DiscourseNodeShape = TLBaseShape<
  string,
  {
    w: number;
    h: number;
    opacity: TLOpacityType;
    uid: string;
    title: string;
    imageUrl?: string;
  }
>;

const getRelationIds = () =>
  new Set(
    Object.values(discourseContext.relations).flatMap((rs) =>
      rs.map((r) => r.id)
    )
  );

export class DiscourseNodeUtil extends TLBoxUtil<DiscourseNodeShape> {
  constructor(app: TldrawApp, type: string) {
    super(app, type);
  }

  override isAspectRatioLocked = () => false;
  override canResize = () => true;
  override canBind = () => true;
  override canEdit = () => true;

  override defaultProps(): DiscourseNodeShape["props"] {
    return {
      opacity: "1" as DiscourseNodeShape["props"]["opacity"],
      w: 160,
      h: 64,
      uid: window.roamAlphaAPI.util.generateUID(),
      title: "",
    };
  }

  deleteRelationsInCanvas(
    shape: DiscourseNodeShape,
    {
      allRecords = this.app.store.allRecords(),
      relationIds = getRelationIds(),
    }: { allRecords?: TLRecord[]; relationIds?: Set<string> } = {}
  ) {
    const toDelete = allRecords
      .filter((r): r is DiscourseRelationShape => {
        return r.typeName === "shape" && relationIds.has(r.type);
      })
      .filter((r) => {
        const { start, end } = r.props;
        return (
          (start.type === "binding" && start.boundShapeId === shape.id) ||
          (end.type === "binding" && end.boundShapeId === shape.id)
        );
      });
    this.app.deleteShapes(toDelete.map((r) => r.id));
  }

  async createExistingRelations(
    shape: DiscourseNodeShape,
    {
      allRecords = this.app.store.allRecords(),
      relationIds = getRelationIds(),
      finalUid = shape.props.uid,
    }: {
      allRecords?: TLRecord[];
      relationIds?: Set<string>;
      finalUid?: string;
    } = {}
  ) {
    const isDiscourseRelationShape = (
      shape: TLShape
    ): shape is DiscourseRelationShape => {
      return relationIds.has(shape.type);
    };
    const nodes = Object.values(discourseContext.nodes);
    const nodeIds = new Set(nodes.map((n) => n.type));
    const nodesInCanvas = Object.fromEntries(
      allRecords
        .filter((r): r is DiscourseNodeShape => {
          return r.typeName === "shape" && nodeIds.has(r.type);
        })
        .map((r) => [r.props.uid, r] as const)
    );
    const currentShapeRelations = allRecords
      .filter(isShape)
      .filter(isDiscourseRelationShape)
      .filter((r) => {
        const { start, end } = r.props;
        return (
          (start.type === "binding" && start.boundShapeId === shape.id) ||
          (end.type === "binding" && end.boundShapeId === shape.id)
        );
      });

    const results = await getDiscourseContextResults({
      uid: finalUid,
      nodes: Object.values(discourseContext.nodes),
      relations: Object.values(discourseContext.relations).flat(),
    });

    const toCreate = results
      .flatMap((r) =>
        Object.entries(r.results)
          .filter(([k, v]) => nodesInCanvas[k] && v.id && relationIds.has(v.id))
          .map(([k, v]) => ({
            relationId: v.id!,
            complement: v.complement,
            nodeId: k,
          }))
      )
      .filter(({ relationId, complement, nodeId }) => {
        const startId = complement ? nodesInCanvas[nodeId].id : shape.id;
        const endId = complement ? shape.id : nodesInCanvas[nodeId].id;
        const relationAlreadyExists = currentShapeRelations.some(
          (r) =>
            r.type === relationId &&
            r.props.start.type === "binding" &&
            r.props.end.type === "binding" &&
            r.props.start.boundShapeId === startId &&
            r.props.end.boundShapeId === endId
        );
        return !relationAlreadyExists;
      })
      .map(({ relationId, complement, nodeId }) => {
        return {
          id: createShapeId(),
          type: relationId,
          props: complement
            ? {
                start: {
                  type: "binding",
                  boundShapeId: nodesInCanvas[nodeId].id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
                end: {
                  type: "binding",
                  boundShapeId: shape.id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
              }
            : {
                start: {
                  type: "binding",
                  boundShapeId: shape.id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
                end: {
                  type: "binding",
                  boundShapeId: nodesInCanvas[nodeId].id,
                  normalizedAnchor: { x: 0.5, y: 0.5 },
                  isExact: false,
                },
              },
        };
      });
    this.app.createShapes(toCreate);
  }

  override onBeforeCreate = (shape: DiscourseNodeShape) => {
    if (discourseContext.lastAppEvent === "pointer_down") {
      setTimeout(() =>
        document.body.dispatchEvent(
          new CustomEvent("roamjs:query-builder:created-canvas-node", {
            detail: shape.id,
          })
        )
      );
    }
  };

  onBeforeDelete(shape: DiscourseNodeShape) {
    this.deleteRelationsInCanvas(shape);
  }

  onAfterCreate(shape: DiscourseNodeShape) {
    if (shape.props.title && shape.props.uid)
      this.createExistingRelations(shape);
  }

  getColors() {
    const {
      canvasSettings: { color: backgroundColor = "" } = {},
      index: discourseNodeIndex = -1,
    } = discourseContext.nodes[this.type] || {};
    const paletteColor =
      COLOR_ARRAY[
        discourseNodeIndex >= 0 && discourseNodeIndex < COLOR_ARRAY.length - 1
          ? discourseNodeIndex
          : 0
      ];
    const formattedBackgroundColor = formatHexColor(backgroundColor);

    const backgroundInfo = formattedBackgroundColor
      ? {
          backgroundColor: formattedBackgroundColor,
          backgroundCss: formattedBackgroundColor,
        }
      : {
          backgroundColor: COLOR_PALETTE[paletteColor],
          backgroundCss: `var(--palette-${paletteColor})`,
        };
    const textColor = ContrastColor.contrastColor({
      bgColor: backgroundInfo.backgroundColor,
    });
    return { ...backgroundInfo, textColor };
  }

  render(shape: DiscourseNodeShape) {
    const extensionAPI = useExtensionAPI();
    const {
      canvasSettings: { alias = "", "key-image": isKeyImage = "" } = {},
    } = discourseContext.nodes[this.type] || {};
    const isEditing = useValue(
      "isEditing",
      () => this.app.editingId === shape.id,
      [this.app, shape.id]
    );
    const [isLabelEditOpen, setIsEditLabelOpen] = useState(false);
    useEffect(() => {
      if (isEditing) setIsEditLabelOpen(true);
    }, [isEditing, setIsEditLabelOpen]);
    const contentRef = useRef<HTMLDivElement>(null);
    const [loaded, setLoaded] = useState("");
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
    useEffect(() => {
      const listener = (e: CustomEvent) => {
        if (e.detail === shape.id) {
          setIsEditLabelOpen(true);
          this.app.setEditingId(shape.id);
        }
      };
      document.body.addEventListener(
        "roamjs:query-builder:created-canvas-node",
        listener as EventListener
      );
      return () => {
        document.body.removeEventListener(
          "roamjs:query-builder:created-canvas-node",
          listener as EventListener
        );
      };
    }, [setIsEditLabelOpen]);

    const { backgroundCss, textColor } = this.getColors();

    const setSizeAndImgProps = async ({
      context,
      text,
      uid,
    }: {
      context: DiscourseNodeUtil;
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
      context.updateProps(shape.id, {
        h,
        w,
        imageUrl,
      });
    };

    return (
      <HTMLContainer
        id={shape.id}
        className="flex items-center justify-center pointer-events-auto rounded-2xl roamjs-tldraw-node overflow-hidden"
        style={{
          background: backgroundCss,
          color: textColor,
        }}
      >
        <div style={{ pointerEvents: "all" }}>
          {shape.props.imageUrl && isKeyImage ? (
            <img
              src={shape.props.imageUrl}
              className="w-full object-cover h-auto"
              draggable="false"
              style={{ pointerEvents: "none" }}
            />
          ) : null}

          <div
            ref={contentRef}
            style={{ ...DEFAULT_STYLE_PROPS, maxWidth: "" }}
          >
            {alias
              ? new RegExp(alias).exec(shape.props.title)?.[1] ||
                shape.props.title
              : shape.props.title}
          </div>
          <LabelDialog
            initialUid={shape.props.uid}
            isOpen={isLabelEditOpen}
            onClose={() => {
              this.app.setEditingId(null);
              setIsEditLabelOpen(false);
            }}
            isExistingCanvasNode={!!shape.props.title}
            nodeType={this.type}
            discourseContext={discourseContext}
            onSuccess={async ({ text, uid, action }) => {
              if (action === "editing") {
                if (isPageUid(shape.props.uid))
                  await window.roamAlphaAPI.updatePage({
                    page: {
                      uid: shape.props.uid,
                      title: text,
                    },
                  });
                else await updateBlock({ uid: shape.props.uid, text });
              }

              if (action === "creating" && !getPageUidByPageTitle(text)) {
                createDiscourseNode({
                  configPageUid: shape.type,
                  text,
                  newPageUid: uid,
                });
              }

              // Update Shape Props
              await setSizeAndImgProps({ context: this, text, uid });
              this.updateProps(shape.id, {
                title: text,
                uid,
              });

              // Update Shape Relations
              const allRecords = this.app.store.allRecords();
              const relationIds = getRelationIds();
              this.deleteRelationsInCanvas(shape, {
                allRecords,
                relationIds,
              });
              await this.createExistingRelations(shape, {
                allRecords,
                relationIds,
                finalUid: uid,
              });

              setIsEditLabelOpen(false);
              this.app.setEditingId(null);
            }}
            onCancel={() => {
              this.app.setEditingId(null);
              setIsEditLabelOpen(false);
              if (!isLiveBlock(shape.props.uid)) {
                this.app.deleteShapes([shape.id]);
              }
            }}
          />
        </div>
      </HTMLContainer>
    );
  }

  async toSvg(shape: DiscourseNodeShape) {
    const { backgroundColor, textColor } = this.getColors();
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Create and set attributes for the rectangle (background of the shape)
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", shape.props.w.toString());
    rect.setAttribute("height", shape.props.h.toString());
    rect.setAttribute("fill", backgroundColor);
    rect.setAttribute("opacity", shape.props.opacity);
    rect.setAttribute("rx", "16");
    rect.setAttribute("ry", "16");
    g.appendChild(rect);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

    // Calculate text dimensions and positioning
    const padding = Number(DEFAULT_STYLE_PROPS.padding.replace("px", ""));
    const textWidth = measureCanvasNodeText({
      ...DEFAULT_STYLE_PROPS,
      maxWidth: shape.props.w - padding * 2 + "px",
      text: shape.props.title,
    }).w;

    const textLines = this.app.textMeasure.getTextLines({
      fontFamily: DEFAULT_STYLE_PROPS.fontFamily,
      fontSize: DEFAULT_STYLE_PROPS.fontSize,
      fontStyle: DEFAULT_STYLE_PROPS.fontStyle,
      fontWeight: DEFAULT_STYLE_PROPS.fontWeight,
      lineHeight: DEFAULT_STYLE_PROPS.lineHeight,
      height: shape.props.h,
      text: shape.props.title,
      padding: 0,
      textAlign: "start",
      width: textWidth,
      wrap: true,
    });

    // set attributes for the text
    text.setAttribute("font-family", SVG_FONT_FAMILY);
    text.setAttribute("font-size", DEFAULT_STYLE_PROPS.fontSize + "px");
    text.setAttribute("font-weight", DEFAULT_STYLE_PROPS.fontWeight);
    text.setAttribute("fill", textColor);
    text.setAttribute("stroke", "none");

    const textX = (shape.props.w - textWidth) / 2;
    const lineHeight =
      DEFAULT_STYLE_PROPS.lineHeight * DEFAULT_STYLE_PROPS.fontSize;

    // Loop through words and add them to lines, wrapping as needed
    textLines.forEach((line, index) => {
      const tspan = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "tspan"
      );
      tspan.setAttribute("x", textX.toString());
      tspan.setAttribute("dy", (index === 0 ? 0 : lineHeight).toString());
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    // Add image to the node if imageUrl exists

    // https://github.com/tldraw/tldraw/blob/8a1b014b02a1960d1e6dde63722f9f221a33e10c/packages/tldraw/src/lib/shapes/image/ImageShapeUtil.tsx#L44
    async function getDataURIFromURL(url: string): Promise<string> {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    if (shape.props.imageUrl) {
      const image = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "image"
      );
      const src = (await getDataURIFromURL(shape.props.imageUrl)) || "";
      image.setAttribute("href", src);
      image.setAttribute("width", shape.props.w.toString());

      // Calculate height based on aspect ratio like in the HTML
      const { width: imageWidth, height: imageHeight } = await loadImage(src);
      const aspectRatio = imageWidth / imageHeight || 1;
      const svgImageHeight = shape.props.w / aspectRatio;

      // TODO - allow for cropped images (css overflow-hidden)
      image.setAttribute("height", svgImageHeight.toString());

      // Adjust text y attribute to be positioned below the image
      const textYOffset =
        svgImageHeight +
        (shape.props.h - svgImageHeight) / 2 -
        (lineHeight * textLines.length) / 2;
      text.setAttribute("y", textYOffset.toString());

      g.appendChild(image);
    } else {
      // Position the text vertically in the center of the shape
      const textY =
        (shape.props.h - lineHeight * textLines.length) / 2 + padding / 2;
      text.setAttribute("y", textY.toString());
    }

    g.appendChild(text);

    return g;
  }

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  updateProps(
    id: DiscourseNodeShape["id"],
    props: Partial<DiscourseNodeShape["props"]>
  ) {
    // @ts-ignore
    this.app.updateShapes([{ id, props }]);
  }
}
