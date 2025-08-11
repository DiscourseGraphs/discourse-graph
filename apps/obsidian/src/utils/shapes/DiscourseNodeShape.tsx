import { BaseBoxShapeUtil, HTMLContainer, T, TLBaseShape } from "tldraw";
import type { App, TFile } from "obsidian";
import { resolveLinkedFileFromSrc } from "~/utils/asset-store";

export type DiscourseNodeShape = TLBaseShape<
  "discourse-node",
  {
    w: number;
    h: number;
    // asset-style source: asset:obsidian.blockref.<id>
    src: string | null;
    nodeType: string;
  }
>;

export class DiscourseNodeUtil extends BaseBoxShapeUtil<DiscourseNodeShape> {
  static type = "discourse-node" as const;

  static props = {
    w: T.number,
    h: T.number,
    src: T.string,
    nodeType: T.string,
    backgroundColor: T.string,
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      src: null,
      nodeType: "default",
    };
  }

  component(shape: DiscourseNodeShape) {
    return (
      <HTMLContainer>
        <div>
          <h1>Discourse Node</h1>
          <p>{shape.props.nodeType}</p>
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  async getFile(
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<TFile | null> {
    return resolveLinkedFileFromSrc(ctx.app, ctx.canvasFile, shape.props.src ?? undefined);
  }

  async getFrontmatter(
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<Record<string, unknown> | null> {
    const file = await this.getFile(shape, ctx);
    if (!file) return null;
    const fm = ctx.app.metadataCache.getFileCache(file)?.frontmatter ?? null;
    return fm as unknown as Record<string, unknown> | null;
  }

  async getDiscourseNodeType(
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<string | null> {
    const frontmatter = await this.getFrontmatter(shape, ctx);
    if (!frontmatter) return null;
    return (frontmatter as { nodeTypeId?: string }).nodeTypeId ?? null;
  }

  async getRelations(
    shape: DiscourseNodeShape,
    ctx: { app: App; canvasFile: TFile },
  ): Promise<unknown[]> {
    const frontmatter = await this.getFrontmatter(shape, ctx);
    if (!frontmatter) return [];
    // TODO: derive relations from frontmatter when schema is defined
    return [];
  }
}
