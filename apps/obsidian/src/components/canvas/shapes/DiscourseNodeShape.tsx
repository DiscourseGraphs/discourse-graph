import {
  BaseBoxShapeUtil,
  HTMLContainer,
  resizeBox,
  T,
  TLBaseShape,
  TLResizeInfo,
  useEditor,
} from "tldraw";
import type { App, TFile } from "obsidian";
import { memo, createElement, useEffect } from "react";
import DiscourseGraphPlugin from "~/index";
import {
  getFrontmatterForFile,
  FrontmatterRecord,
  getFirstImageSrcForFile,
} from "./discourseNodeShapeUtils";
import { resolveLinkedFileFromSrc } from "~/components/canvas/stores/assetStore";
import { getNodeTypeById } from "~/utils/typeUtils";
import { calcDiscourseNodeSize } from "~/utils/calcDiscourseNodeSize";

export type DiscourseNodeShape = TLBaseShape<
  "discourse-node",
  {
    w: number;
    h: number;
    // asset-style source: asset:obsidian.blockref.<id>
    src: string | null;
    // Cached display data
    title: string;
    nodeTypeId: string;
    imageSrc?: string;
  }
>;

export type DiscourseNodeUtilOptions = {
  app: App;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

export class DiscourseNodeUtil extends BaseBoxShapeUtil<DiscourseNodeShape> {
  static type = "discourse-node" as const;
  declare options: DiscourseNodeUtilOptions;

  static props = {
    w: T.number,
    h: T.number,
    src: T.string.nullable(),
    title: T.string.optional(),
    nodeTypeId: T.string.nullable().optional(),
    imageSrc: T.string.optional(),
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      src: null,
      title: "",
      nodeTypeId: "",
      imageSrc: undefined,
    };
  }

  override isAspectRatioLocked = () => false;
  override canResize = () => true;

  override onResize(
    shape: DiscourseNodeShape,
    info: TLResizeInfo<DiscourseNodeShape>,
  ) {
    return resizeBox(shape, info);
  }

  component(shape: DiscourseNodeShape) {
    return (
      <HTMLContainer>
        {createElement(discourseNodeContent, {
          shape,
          app: this.options.app,
          canvasFile: this.options.canvasFile,
          plugin: this.options.plugin,
        })}
      </HTMLContainer>
    );
  }

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  getFile = async (
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<TFile | null> => {
    const app = ctx?.app ?? this.options.app;
    const canvasFile = ctx?.canvasFile ?? this.options.canvasFile;
    return resolveLinkedFileFromSrc({
      app,
      canvasFile,
      src: shape.props.src ?? undefined,
    });
  };

  getFrontmatter = async (
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<FrontmatterRecord | null> => {
    const app = ctx?.app ?? this.options.app;
    const file = await this.getFile(shape, ctx);
    if (!file) return null;
    return getFrontmatterForFile(app, file);
  };

  getRelations = async (
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<unknown[]> => {
    const frontmatter = await this.getFrontmatter(shape, ctx);
    if (!frontmatter) return [];
    // TODO: derive relations from frontmatter
    return [];
  };
}

const discourseNodeContent = memo(
  ({
    shape,
    app,
    canvasFile,
    plugin,
  }: {
    shape: DiscourseNodeShape;
    app: App;
    canvasFile: TFile;
    plugin: DiscourseGraphPlugin;
  }) => {
    const editor = useEditor();
    const { src, title, nodeTypeId } = shape.props;
    const nodeType = getNodeTypeById(plugin, nodeTypeId);

    useEffect(() => {
      const loadNodeData = async () => {
        if (!src) {
          editor.updateShape<DiscourseNodeShape>({
            id: shape.id,
            type: "discourse-node",
            props: {
              ...shape.props,
              title: "(no source)",
            },
          });
          return;
        }

        try {
          const linkedFile = await resolveLinkedFileFromSrc({
            app,
            canvasFile,
            src,
          });

          if (!linkedFile) {
            return;
          }

          if (linkedFile.basename !== shape.props.title) {
            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                title: linkedFile.basename,
              },
            });
          }

          let didImageChange = false;
          let currentImageSrc = shape.props.imageSrc;
          if (nodeType?.keyImage) {
            const imageSrc = await getFirstImageSrcForFile(app, linkedFile);

            if (imageSrc && imageSrc !== shape.props.imageSrc) {
              didImageChange = true;
              currentImageSrc = imageSrc;
              editor.updateShape<DiscourseNodeShape>({
                id: shape.id,
                type: "discourse-node",
                props: {
                  ...shape.props,
                  imageSrc,
                },
              });
            }
          } else if (shape.props.imageSrc) {
            didImageChange = true;
            currentImageSrc = undefined;
            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                imageSrc: undefined,
              },
            });
          }

          if (didImageChange) {
            const { w, h } = await calcDiscourseNodeSize({
              title: linkedFile.basename,
              nodeTypeId: shape.props.nodeTypeId,
              imageSrc: currentImageSrc,
              plugin,
            });
            // Only update dimensions if they differ significantly (>1px)
            if (
              Math.abs((shape.props.w || 0) - w) > 1 ||
              Math.abs((shape.props.h || 0) - h) > 1
            ) {
              editor.updateShape<DiscourseNodeShape>({
                id: shape.id,
                type: "discourse-node",
                props: {
                  ...shape.props,
                  w,
                  h,
                },
              });
            }
          }
        } catch (error) {
          console.error("Error loading node data", error);
          return;
        }
      };

      void loadNodeData();

      return () => {
        return;
      };
      // Only trigger when content changes, not when dimensions change (to avoid fighting manual resizing)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
      src,
      shape.id,
      shape.props.title,
      shape.props.nodeTypeId,
      shape.props.imageSrc,
      editor,
      app,
      canvasFile,
      plugin,
      nodeType?.keyImage,
    ]);

    return (
      <div
        style={{
          backgroundColor: nodeType?.color ?? "",
        }}
        // NOTE: These Tailwind classes (p-2, border-2, rounded-md, m-1, text-base, m-0, text-sm)
        // correspond to constants in nodeConstants.ts. If you change these classes, update the
        // constants and the measureNodeText function to keep measurements accurate.
        className="box-border flex h-full w-full flex-col items-start justify-start rounded-md border-2 p-2"
      >
        <h1 className="m-1 text-base">{title || "..."}</h1>
        <p className="m-0 text-sm opacity-80">{nodeType?.name || ""}</p>
        {shape.props.imageSrc ? (
          <div className="mt-2 flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
            <img
              src={shape.props.imageSrc}
              loading="lazy"
              decoding="async"
              draggable="false"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : null}
      </div>
    );
  },
);

discourseNodeContent.displayName = "DiscourseNodeContent";

export const createDiscourseNodeUtil = (options: DiscourseNodeUtilOptions) => {
  const configuredUtil = class extends DiscourseNodeUtil {
    options = options;
  };
  return configuredUtil;
};
