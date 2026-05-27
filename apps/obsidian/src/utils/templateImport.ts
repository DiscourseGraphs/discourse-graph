/* eslint-disable @typescript-eslint/naming-convention */
import type { Json } from "@repo/database/dbTypes";
import type DiscourseGraphPlugin from "~/index";
import {
  fetchUserNames,
  getAvailableGroupIds,
  getSpaceNameFromIds,
  getSpaceUris,
} from "./importNodes";
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import { getUserNameById } from "./typeUtils";

export type TemplateImportCandidate = {
  id: number;
  sourceNodeTypeId: string;
  nodeTypeName: string;
  templateName: string;
  templateContent: string;
  authorId?: number;
  authorName?: string;
  spaceId: number;
  spaceName: string;
  spaceUri?: string;
  lastModified?: number;
};

const parseLiteralContent = (literalContent: Json): Record<string, unknown> => {
  if (typeof literalContent === "string") {
    try {
      return JSON.parse(literalContent) as Record<string, unknown>;
    } catch (error) {
      console.error("Failed to parse schema literal_content:", error);
      return {};
    }
  }

  if (
    literalContent &&
    typeof literalContent === "object" &&
    !Array.isArray(literalContent)
  ) {
    return literalContent as Record<string, unknown>;
  }

  return {};
};

const getTemplateFields = (
  literalContent: Json,
): { templateName?: string; templateContent?: string } => {
  const content = parseLiteralContent(literalContent);
  const templateName = content.template;
  const templateContent = content.template_content;

  return {
    templateName: typeof templateName === "string" ? templateName : undefined,
    templateContent:
      typeof templateContent === "string" ? templateContent : undefined,
  };
};

export const fetchTemplateImportCandidates = async ({
  plugin,
  nodeTypeName,
}: {
  plugin: DiscourseGraphPlugin;
  nodeTypeName: string;
}): Promise<TemplateImportCandidate[]> => {
  const trimmedNodeTypeName = nodeTypeName.trim();
  if (!trimmedNodeTypeName) return [];

  const client = await getLoggedInClient(plugin);
  if (!client) {
    throw new Error("Cannot get Supabase client");
  }

  const context = await getSupabaseContext(plugin);
  if (!context) {
    throw new Error("Cannot get Supabase context");
  }

  const groupIds = await getAvailableGroupIds(client);
  if (groupIds.length === 0) return [];

  await fetchUserNames(plugin, client);

  const { data, error } = await client
    .from("my_concepts")
    .select(
      "id, source_local_id, name, literal_content, author_id, space_id, last_modified",
    )
    .eq("is_schema", true)
    .eq("arity", 0)
    .eq("name", trimmedNodeTypeName)
    .neq("space_id", context.spaceId);

  if (error) {
    console.error("Error fetching shared template candidates:", error);
    throw new Error(`Failed to fetch shared templates: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    id: number;
    source_local_id: string | null;
    name: string | null;
    literal_content: Json;
    author_id: number | null;
    space_id: number | null;
    last_modified: string | null;
  }>;

  const rowsWithTemplates = rows
    .map((row) => {
      const { templateName, templateContent } = getTemplateFields(
        row.literal_content,
      );

      if (
        !row.source_local_id ||
        !row.name ||
        row.space_id === null ||
        !templateName ||
        templateContent === undefined
      ) {
        return null;
      }

      return {
        row,
        templateName,
        templateContent,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        row: (typeof rows)[number];
        templateName: string;
        templateContent: string;
      } => candidate !== null,
    );

  const spaceIds = [
    ...new Set(rowsWithTemplates.map(({ row }) => row.space_id!)),
  ];
  const [spaceNames, spaceUris] = await Promise.all([
    getSpaceNameFromIds(client, spaceIds),
    getSpaceUris(client, spaceIds),
  ]);

  return rowsWithTemplates
    .map(({ row, templateName, templateContent }) => {
      const spaceId = row.space_id!;
      return {
        id: row.id,
        sourceNodeTypeId: row.source_local_id!,
        nodeTypeName: row.name!,
        templateName,
        templateContent,
        authorId: row.author_id ?? undefined,
        authorName: row.author_id
          ? getUserNameById(plugin, row.author_id)
          : undefined,
        spaceId,
        spaceName: spaceNames.get(spaceId) ?? `Space ${spaceId}`,
        spaceUri: spaceUris.get(spaceId),
        lastModified: row.last_modified
          ? new Date(row.last_modified + "Z").valueOf()
          : undefined,
      };
    })
    .sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
};
