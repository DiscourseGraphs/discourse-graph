import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  TLBaseShape,
  useEditor,
} from "tldraw";
import type { App, TFile } from "obsidian";
import { memo, createElement, useEffect } from "react";
import DiscourseGraphPlugin from "~/index";
import {
  getFrontmatterForFile,
  FrontmatterRecord,
} from "./discourseNodeShapeUtils";
import { resolveLinkedFileFromSrc } from "~/components/canvas/stores/assetStore";
import { getNodeTypeById } from "~/utils/utils";

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

          // Load key image if enabled on node type
          if (nodeType?.keyImage) {
            const imageSrc = await (async (): Promise<string | null> => {
              try {
                const { getFirstImageSrcForFile } = (await import(
                  "./discourseNodeShapeUtils.js"
                )) as {
                  getFirstImageSrcForFile: (
                    app: App,
                    file: TFile,
                  ) => Promise<string | null>;
                };
                return await getFirstImageSrcForFile(app, linkedFile);
              } catch (e) {
                console.warn("Failed loading image extraction util", e);
                return null;
              }
            })();

            if (imageSrc && imageSrc !== shape.props.imageSrc) {
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
            // Clear image if node type no longer has key image enabled
            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                imageSrc: undefined,
              },
            });
          }

          const paddingY = 2 * 8; // p-2 = 0.5rem = 8px
          const titleHeight = 20; // approx
          const subtitleHeight = 16; // approx
          const maxImageHeight = 160;
          const targetHeight =
            paddingY + maxImageHeight + titleHeight + subtitleHeight + 4;
          if (Math.abs((shape.props.h || 0) - targetHeight) > 1) {
            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                h: Math.max(shape.props.h, targetHeight),
              },
            });
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
    }, [
      src,
      shape.id,
      shape.props,
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
        className="box-border flex h-full w-full flex-col items-start justify-start rounded-md border-2 p-2"
      >
        <h1 className="m-0 mt-1 text-base">{title || "..."}</h1>
        <p className="m-0 text-sm opacity-80">{nodeType?.name || ""}</p>
        {shape.props.imageSrc ? (
          <img
            src={shape.props.imageSrc}
            draggable="false"
            className="w-full object-cover"
            style={{ maxHeight: 160 }}
          />
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
