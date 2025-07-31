import { BaseBoxShapeUtil, HTMLContainer, T, TLBaseShape } from "tldraw";
import * as React from "react";
import { useApp } from "~/components/AppContext";

export type DiscourseNodeShape = TLBaseShape<
  "discourse-node",
  {
    w: number;
    h: number;
    text: string;
    filePath: string; // TODO: maybe re-introduce nodeInstanceId as the identifier
    nodeType: string;
  }
>;

// Define the shape util class
export class DiscourseNodeUtil extends BaseBoxShapeUtil<DiscourseNodeShape> {
  static type = "discourse-node" as const;

  static props = {
    w: T.number,
    h: T.number,
    text: T.string,
    filePath: T.string,
    nodeType: T.string,
    backgroundColor: T.string,
  };

  getDefaultProps(): DiscourseNodeShape["props"] {
    return {
      w: 200,
      h: 100,
      text: "New Discourse Node",
      filePath: "",
      nodeType: "default",
    };
  }

  component(shape: DiscourseNodeShape) {
    return <HTMLContainer>
      <div>
        <h1>{shape.props.text}</h1>
        <p>{shape.props.nodeType}</p>
      </div>
    </HTMLContainer>;
  }

  indicator(shape: DiscourseNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  getFrontmatter(shape: DiscourseNodeShape) {
    const app = useApp();
    if (!app) return null;

    const file = app.vault.getFileByPath(shape.props.filePath);
    if (!file) return null;

    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter) return null;
    return frontmatter;
  }

  getDiscourseNodeType(shape: DiscourseNodeShape) {
    const frontmatter = this.getFrontmatter(shape);
    if (!frontmatter) return null;

    return frontmatter.nodeTypeId;
  }

  getRelations(shape: DiscourseNodeShape) {
    const frontmatter = this.getFrontmatter(shape);
    if (!frontmatter) return null;

    // TODO: Get relations from frontmatter
    return [];
  }
}
