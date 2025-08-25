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
  getNodeTypeIdFromFrontmatter,
  getNodeTypeById,
  FrontmatterRecord,
} from "./discourseNodeShapeUtils";
import { DiscourseNode } from "~/types";
import { resolveLinkedFileFromSrc } from "~/components/canvas/stores/assetStore";

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
    nodeTypeName: T.string.optional(),
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      src: null,
      title: "",
      nodeTypeId: "",
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

  async getFile(
    shape: DiscourseNodeShape,
    ctx?: { app: App; canvasFile: TFile },
  ): Promise<TFile | null> {
    const app = ctx?.app ?? this.options.app;
    const canvasFile = ctx?.canvasFile ?? this.options.canvasFile;
    return resolveLinkedFileFromSrc({
      app,
      canvasFile,
      src: shape.props.src ?? undefined,
    });
  }

  async getFrontmatter(
    shape: DiscourseNodeShape,
    ctx?: { app: App; canvasFile: TFile },
  ): Promise<FrontmatterRecord | null> {
    const app = ctx?.app ?? this.options.app;
    const file = await this.getFile(shape, ctx);
    if (!file) return null;
    return getFrontmatterForFile(app, file);
  }

  async getDiscourseNodeType(
    shape: DiscourseNodeShape,
    ctx?: { app: App; canvasFile: TFile },
  ): Promise<DiscourseNode | null> {
    const frontmatter = await this.getFrontmatter(shape, ctx);
    const nodeTypeId = getNodeTypeIdFromFrontmatter(frontmatter);
    return getNodeTypeById(this.options.plugin, nodeTypeId);
  }

  async getRelations(
    shape: DiscourseNodeShape,
    ctx?: { app: App; canvasFile: TFile },
  ): Promise<unknown[]> {
    const frontmatter = await this.getFrontmatter(shape, ctx);
    if (!frontmatter) return [];
    // TODO: derive relations from frontmatter
    return [];
  }
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
            editor.updateShape<DiscourseNodeShape>({
              id: shape.id,
              type: "discourse-node",
              props: {
                ...shape.props,
                title: "(unlinked)",
              },
            });
            return;
          }

          editor.updateShape<DiscourseNodeShape>({
            id: shape.id,
            type: "discourse-node",
            props: {
              ...shape.props,
              title: linkedFile.basename,
            },
          });
        } catch (error) {
          console.error("Error loading node data", error);
          return;
        }
      };

      void loadNodeData();

      return () => {
        return;
      };
    }, [src, shape.id, shape.props, editor, app, canvasFile, plugin]);

    return (
      <div
        style={{
          backgroundColor: nodeType?.color ?? "",
        }}
        className="box-border flex h-full w-full flex-col items-start justify-center rounded-md border-2 p-2"
      >
        <h1 className="m-0 text-base">{title || "..."}</h1>
        <p className="m-0 text-sm opacity-80">{nodeType?.name || ""}</p>
      </div>
    );
  },
);

discourseNodeContent.displayName = "DiscourseNodeContent";
