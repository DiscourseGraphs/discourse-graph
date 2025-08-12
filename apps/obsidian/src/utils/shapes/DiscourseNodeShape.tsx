import { BaseBoxShapeUtil, HTMLContainer, T, TLBaseShape } from "tldraw";
import type { App, TFile } from "obsidian";
import { resolveLinkedFileFromSrc } from "~/utils/assetStore";
import DiscourseGraphPlugin from "~/index";
import { DiscourseNode } from "~/types";

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
    backgroundColor: T.string,
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      src: null,
    };
  }

  async component(shape: DiscourseNodeShape) {
    const file = await this.getFile(shape, {
      app: this.options.app,
      canvasFile: this.options.canvasFile,
    });

    const nodeType = await this.getDiscourseNodeType(shape, {
      app: this.options.app,
      canvasFile: this.options.canvasFile,
    });
    return (
      <HTMLContainer
        style={{
          backgroundColor: nodeType?.color ?? "transparent",
          borderRadius: "10px",
        }}
      >
        <div>
          <h1>{file?.basename}</h1>
          <p>{nodeType?.name ?? "Unknown"}</p>
        </div>
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
    return resolveLinkedFileFromSrc(
      app,
      canvasFile,
      shape.props.src ?? undefined,
    );
  }

  async getFrontmatter(
    shape: DiscourseNodeShape,
    ctx?: { app: App; canvasFile: TFile },
  ): Promise<Record<string, unknown> | null> {
    const app = ctx?.app ?? this.options.app;
    const file = await this.getFile(shape, ctx);
    if (!file) return null;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? null;
    return fm as unknown as Record<string, unknown> | null;
  }

  async getDiscourseNodeType(
    shape: DiscourseNodeShape,
    ctx?: { app: App; canvasFile: TFile },
  ): Promise<DiscourseNode | null> {
    const frontmatter = await this.getFrontmatter(shape, ctx);
    if (!frontmatter) return null;
    const nodeTypeId = (frontmatter as { nodeTypeId?: string }).nodeTypeId;
    if (!nodeTypeId) return null;
    const nodeType = this.options.plugin.settings.nodeTypes.find(
      (nodeType) => nodeType.id === nodeTypeId,
    );
    return nodeType ?? null;
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
