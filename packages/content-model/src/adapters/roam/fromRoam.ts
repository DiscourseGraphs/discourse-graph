import type { BlockAnnotation, BodyAnnotation, DgDocument } from "../../schema";
import { offsetAnnotations } from "../../core/annotations";
import { parseInlineText } from "../../core/parser";
import { createDgDocument } from "../../text";

export type RoamViewType = "bullet" | "document" | "numbered";

export type RoamTreeNode = {
  uid: string;
  text: string;
  viewType?: RoamViewType;
  children?: RoamTreeNode[];
};

const mapViewType = (
  viewType: RoamViewType | undefined,
): BlockAnnotation["attributes"]["viewType"] => {
  if (viewType === "numbered") return "numbered";
  if (viewType === "document") return "paragraph";
  return "bullet";
};

const appendRoamNode = ({
  node,
  depth,
  parentBlockId,
  inheritedViewType,
  textParts,
  annotations,
}: {
  node: RoamTreeNode;
  depth: number;
  parentBlockId?: string;
  inheritedViewType?: RoamViewType;
  textParts: string[];
  annotations: BodyAnnotation[];
}): void => {
  const inline = parseInlineText(node.text);
  const start = textParts.join("").length;
  textParts.push(`${inline.text}\n`);
  const end = textParts.join("").length;
  const viewType = node.viewType ?? inheritedViewType ?? "bullet";
  annotations.push(
    {
      type: "block",
      start,
      end,
      attributes: {
        blockId: node.uid,
        parentBlockId,
        depth,
        viewType: mapViewType(viewType),
      },
    },
    ...offsetAnnotations(inline.annotations, start),
  );
  for (const child of node.children ?? []) {
    appendRoamNode({
      node: child,
      depth: depth + 1,
      parentBlockId: node.uid,
      inheritedViewType: viewType,
      textParts,
      annotations,
    });
  }
};

export const roamTreeToBody = ({
  children,
  viewType,
}: {
  children: RoamTreeNode[];
  viewType?: RoamViewType;
}) => {
  const textParts: string[] = [];
  const annotations: BodyAnnotation[] = [];
  for (const child of children) {
    appendRoamNode({
      node: child,
      depth: 0,
      inheritedViewType: viewType,
      textParts,
      annotations,
    });
  }
  return {
    text: textParts.join(""),
    annotations,
  };
};

export const fromRoamTree = ({
  title,
  titleUid,
  children,
  viewType,
  metadata,
}: {
  title: string;
  titleUid?: string;
  children: RoamTreeNode[];
  viewType?: RoamViewType;
  metadata?: DgDocument["metadata"];
}): DgDocument =>
  createDgDocument({
    title: parseInlineText(title),
    body: roamTreeToBody({ children, viewType }),
    metadata: {
      ...(metadata ?? {}),
      ...(titleUid ? { roamPageUid: titleUid } : {}),
    },
  });

export const fromRoamText = ({
  title,
  text,
  sourceLocalId,
  metadata,
}: {
  title: string;
  text: string;
  sourceLocalId: string;
  metadata?: DgDocument["metadata"];
}): DgDocument =>
  fromRoamTree({
    title,
    titleUid: sourceLocalId,
    children: [
      {
        uid: `${sourceLocalId}-body`,
        text,
        viewType: "document",
      },
    ],
    viewType: "document",
    metadata,
  });
