import { TEXT_PLAIN_CONTENT_TYPE } from "@repo/content-model";

type ContentWithType = {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  content_type?: string | null;
};

export const splitEmbeddableContentNodes = <T extends ContentWithType>(
  contentNodes: T[],
): {
  embeddableContentNodes: T[];
  nonEmbeddableContentNodes: T[];
} => ({
  embeddableContentNodes: contentNodes.filter(
    (node) =>
      (node.content_type ?? TEXT_PLAIN_CONTENT_TYPE) ===
      TEXT_PLAIN_CONTENT_TYPE,
  ),
  nonEmbeddableContentNodes: contentNodes.filter(
    (node) =>
      (node.content_type ?? TEXT_PLAIN_CONTENT_TYPE) !==
      TEXT_PLAIN_CONTENT_TYPE,
  ),
});
