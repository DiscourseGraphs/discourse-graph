import { BaseBoxShapeUtil, HTMLContainer, T, TLBaseShape } from "tldraw";
import type { App, TFile } from "obsidian";
import { useEffect, useState } from "react";
import DiscourseGraphPlugin from "~/index";
import {
  getLinkedFileFromSrc,
  getFrontmatterForFile,
  getNodeTypeIdFromFrontmatter,
  getNodeTypeById,
} from "./discourseNodeShapeUtils";
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
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      src: null,
    };
  }

  component(shape: DiscourseNodeShape) {
    const { app, canvasFile, plugin } = this.options;
    return (
      <HTMLContainer>
        <DiscourseNodeContent
          app={app}
          canvasFile={canvasFile}
          plugin={plugin}
          src={shape.props.src ?? null}
        />
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
  ): Promise<Record<string, unknown> | null> {
    const app = ctx?.app ?? this.options.app;
    const file = await this.getFile(shape, ctx);
    if (!file) return null;
    return getFrontmatterForFile(app, file) as unknown as Record<
      string,
      unknown
    > | null;
  }

  async getDiscourseNodeType(
    shape: DiscourseNodeShape,
    ctx?: { app: App; canvasFile: TFile },
  ): Promise<DiscourseNode | null> {
    const frontmatter = await this.getFrontmatter(shape, ctx);
    const nodeTypeId = getNodeTypeIdFromFrontmatter(
      frontmatter as unknown as Record<string, unknown> | null,
    );
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

const DiscourseNodeContent = ({
  app,
  canvasFile,
  plugin,
  src,
}: {
  app: App;
  canvasFile: TFile;
  plugin: DiscourseGraphPlugin;
  src: string | null;
}) => {
  const [title, setTitle] = useState<string>("...");
  const [nodeTypeName, setNodeTypeName] = useState<string>("");
  const [nodeColor, setNodeColor] = useState<string>("transparent");
  const [linkedFile, setLinkedFile] = useState<TFile | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      try {
        if (!src) return;
        const linked = await getLinkedFileFromSrc(app, canvasFile, src);
        if (!linked) return;
        if (isCancelled) return;
        setLinkedFile(linked);
        setTitle(linked.basename);

        const fm = getFrontmatterForFile(app, linked);
        const nodeTypeId = getNodeTypeIdFromFrontmatter(
          fm as unknown as Record<string, unknown> | null,
        );
        const nodeType = getNodeTypeById(plugin, nodeTypeId);
        if (isCancelled) return;
        setNodeTypeName(nodeType?.name ?? "");
        setNodeColor(nodeType?.color ?? "transparent");
      } catch (err) {
        console.error("Error fetching discourse node data:", err);
      }
    };
    void run();
    // Re-run when the canvas file's metadata changes (e.g., after we insert the blockref)
    const refChanged = app.metadataCache.on("changed", (file) => {
      if (file.path === canvasFile.path) {
        void run();
      }
    });
    const refResolved = app.metadataCache.on("resolved", () => {
      void run();
    });
    return () => {
      isCancelled = true;
      if (refChanged) app.metadataCache.offref(refChanged);
      if (refResolved) app.metadataCache.offref(refResolved);
    };
  }, [app, canvasFile, src, plugin]);

  return (
    <div
      style={{
        backgroundColor: nodeColor,
      }}
      className="box-border flex h-full w-full flex-col items-start justify-center rounded-md border-2 p-2"
    >
      <h1 style={{ margin: 0, fontSize: 16 }}>{title}</h1>
      <p style={{ margin: 0, opacity: 0.8, fontSize: 12 }}>
        {nodeTypeName || ""}
      </p>
    </div>
  );
};
