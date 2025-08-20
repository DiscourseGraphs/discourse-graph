import { BaseBoxShapeUtil, HTMLContainer, T, TLBaseShape } from "tldraw";
import type { App, TFile } from "obsidian";
import { memo, createElement } from "react";
import DiscourseGraphPlugin from "~/index";
import {
  getLinkedFileFromSrc,
  getFrontmatterForFile,
  getNodeTypeIdFromFrontmatter,
  getNodeTypeById,
  FrontmatterRecord,
} from "./discourseNodeShapeUtils";
import { DiscourseNode } from "~/types";
import { useNodeData } from "~/components/canvas/hooks/useNodeData";

export type DiscourseNodeShape = TLBaseShape<
  "discourse-node",
  {
    w: number;
    h: number;
    // asset-style source: asset:obsidian.blockref.<id>
    src: string | null;
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
    src: T.string,
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      src: null,
    };
  }

  component(shape: DiscourseNodeShape) {
    return (
      <HTMLContainer>
        {createElement(discourseNodeContent, { src: shape.props.src ?? null })}
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
    return getLinkedFileFromSrc(app, canvasFile, shape.props.src ?? null);
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

const discourseNodeContent = memo(({ src }: { src: string | null }) => {
  const { title, nodeTypeName, color } = useNodeData(src);
  return (
    <div
      style={{
        backgroundColor: color,
      }}
      className="box-border flex h-full w-full flex-col items-start justify-center rounded-md border-2 p-2"
    >
      <h1 className="m-0 text-base">{title}</h1>
      <p className="m-0 text-sm opacity-80">{nodeTypeName || ""}</p>
    </div>
  );
});

discourseNodeContent.displayName = "DiscourseNodeContent";
