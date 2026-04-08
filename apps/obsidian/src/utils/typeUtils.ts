import type DiscourseGraphPlugin from "~/index";
import { DiscourseNode, DiscourseRelationType, ImportStatus } from "~/types";
import { ridToSpaceUriAndLocalId } from "./rid";

export const getNodeTypeById = (
  plugin: DiscourseGraphPlugin,
  nodeTypeId: string,
): DiscourseNode | undefined => {
  return plugin.settings.nodeTypes.find((node) => node.id === nodeTypeId);
};

export const getRelationTypeById = (
  plugin: DiscourseGraphPlugin,
  relationTypeId: string,
): DiscourseRelationType | undefined => {
  return plugin.settings.relationTypes.find(
    (relation) => relation.id === relationTypeId,
  );
};

export type ImportInfo = {
  isImported: boolean;
  spaceUri?: string;
  sourceLocalId?: string;
};

export const getImportInfo = (
  importedFromRid: string | undefined,
): ImportInfo => {
  if (!importedFromRid) {
    return { isImported: false };
  }

  try {
    const { spaceUri, sourceLocalId } =
      ridToSpaceUriAndLocalId(importedFromRid);
    return {
      isImported: true,
      spaceUri,
      sourceLocalId,
    };
  } catch (error) {
    console.error("Error parsing importedFromRid:", error);
    return { isImported: false };
  }
};

export const formatImportSource = (
  spaceUri: string,
  spaceNames?: Record<string, string>,
): string => {
  const knownName = spaceNames?.[spaceUri];
  if (knownName) {
    return knownName;
  }

  if (spaceUri.startsWith("obsidian:")) {
    const vaultId = spaceUri.replace("obsidian:", "");
    return `Vault ${vaultId.slice(0, 8)}...`;
  }

  if (spaceUri.startsWith("http")) {
    return spaceUri;
  }

  const parts = spaceUri.split(":");
  if (parts.length === 2) {
    return `${parts[0]}: ${parts[1]}`;
  }

  return spaceUri;
};

export const isAcceptedSchema = (schema: {
  status?: ImportStatus;
  importedFromRid?: string;
}): boolean => !schema.importedFromRid || schema.status === "accepted";

export const isProvisionalSchema = (schema: {
  status?: ImportStatus;
  importedFromRid?: string;
}): boolean => !!schema.importedFromRid && schema.status !== "accepted";

export const getAndFormatImportSource = (
  importedFromRid: string | undefined,
  spaceNames?: Record<string, string>,
): string => {
  const importInfo = getImportInfo(importedFromRid);
  return formatImportSource(importInfo.spaceUri || "", spaceNames);
};
