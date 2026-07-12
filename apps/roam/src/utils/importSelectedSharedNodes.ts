import type { DiscoveredSharedNode } from "./discoverSharedNodes";

export type SharedNodeImportStatus = "imported" | "skipped" | "updated";

export type SharedNodeImportFailure = {
  message: string;
  node: DiscoveredSharedNode;
};

export type SelectedSharedNodeImportResult = {
  failed: SharedNodeImportFailure[];
  imported: number;
  skipped: number;
  updated: number;
};

export type MaterializeSharedNode = (
  node: DiscoveredSharedNode,
) => Promise<SharedNodeImportStatus>;

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Unknown import failure";
};

export const importSelectedSharedNodes = async ({
  materializeNode,
  nodes,
}: {
  materializeNode: MaterializeSharedNode;
  nodes: DiscoveredSharedNode[];
}): Promise<SelectedSharedNodeImportResult> => {
  const result: SelectedSharedNodeImportResult = {
    failed: [],
    imported: 0,
    skipped: 0,
    updated: 0,
  };

  for (const node of nodes) {
    try {
      const status = await materializeNode(node);
      if (status === "updated") {
        result.imported += 1;
        result.updated += 1;
      } else {
        result[status] += 1;
      }
    } catch (error) {
      result.failed.push({ message: getErrorMessage(error), node });
    }
  }

  return result;
};
