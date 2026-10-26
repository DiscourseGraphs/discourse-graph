import posthog from "posthog-js";
import { stripFrontmatter } from "@repo/content-model";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Tables } from "@repo/database/dbTypes";
import type { DbCrossAppNode } from "@repo/database/lib/dbToCrossAppConverters";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import {
  getNodeTypeRid,
  getSharedNodeSpace,
  type SharedNodeListing,
} from "@repo/database/lib/sharedNodes";
import { resolveSchemaFormat } from "@repo/utils/resolveSchemaFormat";
import { createDiscourseNodeType } from "~/components/settings/utils/accessors";
import getDiscourseNodes, {
  excludeDefaultNodes,
  type DiscourseNode,
} from "./getDiscourseNodes";
import internalError from "./internalError";
import refreshConfigTree from "./refreshConfigTree";

const SCHEMA_COLUMNS =
  "format:literal_content->>format, name, source_data_format:literal_content->source_data->>format, source_local_id, space_id, template_content:literal_content->>template_content";

const RESERVED_NODE_TYPE_NAMES = new Set(["Page", "Block", "Any"]);

const RESOLVE_ERROR_TYPE = "Imported node type resolution failed";
const RESOLVE_ERROR_OPERATION = "resolve-shared-node-types";

type SharedNodeSchema = Pick<
  Tables<"my_concepts">,
  "name" | "source_local_id" | "space_id"
> & {
  format: string | null;
  source_data_format: string | null;
  template_content: string | null;
};

// Obsidian publishes the template file as written, so its frontmatter would
// otherwise become template blocks.
export const getTemplateMarkdown = (
  templateContent: string | null | undefined,
): string | undefined => {
  const markdown = stripFrontmatter(templateContent ?? "");
  return markdown.trim() ? markdown : undefined;
};

const findOrCreateNodeType = async (
  schema: SharedNodeSchema,
): Promise<DiscourseNode | undefined> => {
  const localNodeTypes = getDiscourseNodes();
  const matchedById = localNodeTypes.find(
    (nodeType) => nodeType.type === schema.source_local_id,
  );
  if (matchedById) return matchedById;
  const matchedByName = localNodeTypes
    .filter(excludeDefaultNodes)
    .find((nodeType) => nodeType.text === schema.name);
  if (matchedByName) return matchedByName;
  if (!schema.name || !schema.source_local_id) return undefined;
  if (RESERVED_NODE_TYPE_NAMES.has(schema.name)) return undefined;

  const nodeType = await createDiscourseNodeType({
    label: schema.name,
    shortcut: "",
    format: resolveSchemaFormat({
      format: schema.format,
      sourceDataFormat: schema.source_data_format,
    }),
    template: getTemplateMarkdown(schema.template_content),
    uid: schema.source_local_id,
  });
  refreshConfigTree();
  posthog.capture("Discourse Node: Type Created From Import", {
    label: schema.name,
  });
  return nodeType;
};

export const resolveSharedNodeTypes = async ({
  client,
  sharedNodes,
  spaces,
}: {
  client: DGSupabaseClient;
  sharedNodes: DbCrossAppNode[];
  spaces: SharedNodeListing["spaces"];
}): Promise<Map<string, DiscourseNode>> => {
  const schemaRids = [...new Set(sharedNodes.map(getNodeTypeRid))];
  const spaceUrlsById = new Map(
    sharedNodes.map((node) => {
      const space = getSharedNodeSpace({ node, spaces });
      return [space.id, space.url];
    }),
  );
  const { data, error } = await client
    .from("my_concepts")
    .select(SCHEMA_COLUMNS)
    .eq("is_schema", true)
    .eq("is_relation", false)
    .in("space_id", [...spaceUrlsById.keys()])
    .in("source_local_id", [
      ...new Set(sharedNodes.map(({ nodeType }) => nodeType)),
    ]);
  if (error) {
    internalError({
      error,
      type: RESOLVE_ERROR_TYPE,
      context: { operation: RESOLVE_ERROR_OPERATION, schemaRids },
      sendEmail: false,
    });
    return new Map<string, DiscourseNode>();
  }

  const nodeTypeBySchemaRid = new Map<string, DiscourseNode>();
  for (const schema of data) {
    const spaceUrl = spaceUrlsById.get(schema.space_id ?? 0);
    if (!spaceUrl || schema.source_local_id === null) continue;
    const schemaRid = spaceUriAndLocalIdToRid(
      spaceUrl,
      schema.source_local_id,
      "schema",
    );
    if (!schemaRids.includes(schemaRid)) continue;
    try {
      const nodeType = await findOrCreateNodeType(schema);
      if (nodeType) nodeTypeBySchemaRid.set(schemaRid, nodeType);
    } catch (error) {
      internalError({
        error,
        type: RESOLVE_ERROR_TYPE,
        context: {
          operation: RESOLVE_ERROR_OPERATION,
          schemaRid,
          schemaName: schema.name,
        },
        sendEmail: false,
      });
    }
  }

  return nodeTypeBySchemaRid;
};
