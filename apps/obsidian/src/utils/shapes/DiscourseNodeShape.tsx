import path from "path";
import { BaseBoxShapeUtil, HTMLContainer, T, TLBaseShape } from "tldraw";

import { App } from "obsidian";

declare global {
  interface Window {
    app: App;
  }
}

export type DiscourseNodeShape = TLBaseShape<
  "discourse-node",
  {
    w: number;
    h: number;
    wikiLink: string; // The wiki link reference to the file (e.g. "[[My File]]")
    nodeType: string;
  }
>;

// Define the shape util class
export class DiscourseNodeUtil extends BaseBoxShapeUtil<DiscourseNodeShape> {
  static type = "discourse-node" as const;

  static props = {
    w: T.number,
    h: T.number,
    wikiLink: T.string,
    nodeType: T.string,
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      wikiLink: "",
      nodeType: "default",
    };
  }

  component(shape: DiscourseNodeShape) {
    // TODO: Add a proper component for the discourse node (preview of file?)
    let fileName = "";
    const file = this.getFile(shape);
    if (!file) {
      fileName = shape.props.wikiLink.replace(/^\[\[|\]\]$/g, "");
    } else {
      fileName = path.basename(file.basename, ".md");
    }

    return (
      <HTMLContainer>
        <div>
          <h1>{fileName}</h1>
          <p>{shape.props.nodeType}</p>
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  getFile(shape: DiscourseNodeShape) {
    const app = window.app;
    if (!app) return null;
    // Remove [[ and ]] from the wiki link
    const linkText = shape.props.wikiLink.replace(/^\[\[|\]\]$/g, "");
    return app.metadataCache.getFirstLinkpathDest(linkText, "");
  }

  getFrontmatter(shape: DiscourseNodeShape) {
    const app = window.app;
    if (!app) return null;

    const file = this.getFile(shape);
    console.log("file", file);
    if (!file) return null;

    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) return null;
    return frontmatter;
  }

  getDiscourseNodeType(shape: DiscourseNodeShape): string | null {
    const frontmatter = this.getFrontmatter(shape);
    if (!frontmatter) return null;

    return (frontmatter.nodeTypeId as string) || null;
  }

  getRelations(shape: DiscourseNodeShape): string[] {
    const frontmatter = this.getFrontmatter(shape);
    if (!frontmatter) return [];

    // TODO: Get relations from frontmatter
    return [];
  }
}
