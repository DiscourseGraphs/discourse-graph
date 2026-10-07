import type DiscourseGraphPlugin from "~/index";
import { DiscourseNode, DiscourseRelationType, ImportStatus } from "~/types";
import { ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";

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

export const getUserNameById = (
  plugin: DiscourseGraphPlugin,
  id: number,
): string => {
  return (plugin.settings.userNames || {})[id] || `user ${id}`;
};

export const isCompleteRelationType = (rt: DiscourseRelationType): boolean =>
  !!rt.id && !!rt.label && !!rt.complement;

/**
 * Flags relation types whose label or complement repeats another's, keyed by
 * index. Types missing a label or complement are skipped.
 */
export const getRelationTypeErrors = (
  relationTypes: DiscourseRelationType[],
): Record<number, string> => {
  const errors: Record<number, string> = {};
  const completeTypes = relationTypes.filter(isCompleteRelationType);

  const seenLabels = new Map<string, number>();
  for (const rt of completeTypes) {
    const idx = relationTypes.indexOf(rt);
    const prev = seenLabels.get(rt.label);
    if (prev !== undefined) {
      errors[idx] = `Duplicate label "${rt.label}"`;
      if (!errors[prev]) errors[prev] = `Duplicate label "${rt.label}"`;
    }
    seenLabels.set(rt.label, idx);
  }

  const seenComplements = new Map<string, number>();
  for (const rt of completeTypes) {
    const idx = relationTypes.indexOf(rt);
    const prev = seenComplements.get(rt.complement);
    if (prev !== undefined) {
      errors[idx] = `Duplicate complement "${rt.complement}"`;
      if (!errors[prev])
        errors[prev] = `Duplicate complement "${rt.complement}"`;
    }
    seenComplements.set(rt.complement, idx);
  }

  return errors;
};
