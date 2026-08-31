import { describe, expect, it } from "vitest";

import { contentTypes, type ContentType } from "@repo/content-model";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { crossAppNodeToDbContent } from "@repo/database/lib/crossAppConverters";

const createNode = ({
  contentType,
}: {
  contentType: ContentType;
}): CrossAppNode => ({
  localId: "node-1",
  nodeType: "schema-1",
  authorId: "author-1",
  createdAt: new Date(0),
  content: {
    direct: { localId: "node-1", value: "Example" },
    full: {
      localId: "node-1",
      value: "Example body",
      contentType,
      embedding: { value: [0.1, 0.2] },
    },
  },
});

describe("cross-app content embeddings", () => {
  it("keeps embeddings for plain-text content", () => {
    const content = crossAppNodeToDbContent(
      createNode({ contentType: contentTypes.plainText }),
      "full",
    );
    expect(content?.embedding_inline).toMatchObject({ vector: [0.1, 0.2] });
  });

  it("drops embeddings from non-plain representations", () => {
    const content = crossAppNodeToDbContent(
      createNode({ contentType: contentTypes.discourseGraphAtJson }),
      "full",
    );
    expect(content?.embedding_inline).toBeUndefined();
  });
});
