import { z } from "zod";
import type { DiscourseSchemaFile } from "~/types";

export const DG_SCHEMA_EXPORT_VERSION = 1;

const discourseNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  format: z.string(),
  template: z.string().optional(),
  description: z.string().optional(),
  shortcut: z.string().optional(),
  color: z.string().optional(),
  tag: z.string().optional(),
  keyImage: z.boolean().optional(),
  folderPath: z.string().optional(),
  created: z.number(),
  modified: z.number(),
  importedFromRid: z.string().optional(),
  authorId: z.number().optional(),
});

const relationImportStatusSchema = z.enum(["provisional", "accepted"]);

const discourseRelationTypeSchema = z.object({
  id: z.string(),
  label: z.string(),
  complement: z.string(),
  color: z.string(),
  created: z.number(),
  modified: z.number(),
  importedFromRid: z.string().optional(),
  status: relationImportStatusSchema.optional(),
  authorId: z.number().optional(),
});

const discourseRelationSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  destinationId: z.string(),
  relationshipTypeId: z.string(),
  created: z.number(),
  modified: z.number(),
  importedFromRid: z.string().optional(),
  status: relationImportStatusSchema.optional(),
  authorId: z.number().optional(),
});

const templateExportSchema = z.object({
  name: z.string(),
  content: z.string(),
});

export const dgSchemaFileSchema = z.object({
  version: z.literal(DG_SCHEMA_EXPORT_VERSION),
  exportedAt: z.string(),
  pluginVersion: z.string(),
  vaultName: z.string(),
  nodeTypes: z.array(discourseNodeSchema),
  relationTypes: z.array(discourseRelationTypeSchema),
  discourseRelations: z.array(discourseRelationSchema),
  templates: z.array(templateExportSchema),
});

const normalizeToKebabCase = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
};

export const getDgSchemaFileName = (vaultName?: string): string => {
  const normalizedVaultName = vaultName ? normalizeToKebabCase(vaultName) : "";
  const safeVaultName =
    normalizedVaultName.length > 0 ? normalizedVaultName : "vault";
  return `dg-schema-${safeVaultName}.json`;
};

export const parseDgSchemaFile = (value: unknown): DiscourseSchemaFile => {
  return dgSchemaFileSchema.parse(value) as DiscourseSchemaFile;
};
