import type { Json } from "@repo/database/dbTypes";

export type ImportedNodeContentRow = {
  text: string | null;
  created: string | null;
  last_modified: string | null;
  author_id: number | null;
  variant: string | null;
  metadata: Json;
};

export type ImportedNodeContent = {
  fileName: string;
  content: string;
  createdAt: number;
  modifiedAt: number;
  authorId: number;
  filePath?: string;
};

const readFilePath = (metadata: Json): string | undefined => {
  if (typeof metadata !== "object" || metadata === null) return undefined;
  const filePath = (metadata as Record<string, unknown>).filePath;
  return typeof filePath === "string" ? filePath : undefined;
};

// An empty `full` body is valid: a titled node with no content publishes one,
// so only an absent row or a null text rejects the node.
export const resolveImportedNodeContent = (
  rows: ImportedNodeContentRow[],
): ImportedNodeContent | null => {
  const direct = rows.find((row) => row.variant === "direct");
  const full = rows.find((row) => row.variant === "full");
  const authorId = full?.author_id ?? direct?.author_id ?? null;

  if (
    !direct?.text ||
    full?.text == null ||
    full.created === null ||
    full.last_modified === null ||
    authorId === null
  ) {
    return null;
  }

  return {
    fileName: direct.text,
    content: full.text,
    createdAt: new Date(full.created + "Z").valueOf(),
    modifiedAt: new Date(full.last_modified + "Z").valueOf(),
    filePath: readFilePath(direct.metadata),
    authorId,
  };
};
