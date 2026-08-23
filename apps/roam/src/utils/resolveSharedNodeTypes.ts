import posthog from "posthog-js";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Tables } from "@repo/database/dbTypes";
import type { SharedNode } from "@repo/database/lib/sharedNodes";
import { createDiscourseNodeType } from "~/components/settings/utils/accessors";
import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import internalError from "./internalError";
import refreshConfigTree from "./refreshConfigTree";

const SCHEMA_COLUMNS =
  "format:literal_content->>format, id, name, source_data_format:literal_content->source_data->>format, source_local_id";

const RESOLVE_ERROR_TYPE = "Imported node type resolution failed";
const RESOLVE_ERROR_OPERATION = "resolve-shared-node-types";

type SharedNodeSchema = Pick<
  Tables<"my_concepts">,
  "id" | "name" | "source_local_id"
> & {
  format: string | null;
  source_data_format: string | null;
};

const findOrCreateNodeType = async (
  schema: SharedNodeSchema,
): Promise<DiscourseNode | undefined> => {
  const localNodeTypes = getDiscourseNodes();
  const matchedById = localNodeTypes.find(
    (nodeType) => nodeType.type === schema.source_local_id,
  );
  if (matchedById) return matchedById;
  const matchedByName = localNodeTypes.find(
    (nodeType) => nodeType.text === schema.name,
  );
  if (matchedByName) return matchedByName;
  if (!schema.name || !schema.source_local_id) return undefined;

  const nodeType = await createDiscourseNodeType({
    text: schema.name,
    shortcut: "",
    format: schema.source_data_format || schema.format || "",
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
}: {
  client: DGSupabaseClient;
  sharedNodes: SharedNode[];
}): Promise<Map<number, DiscourseNode>> => {
  const schemaIds = [...new Set(sharedNodes.map(({ schemaId }) => schemaId))];
  const { data, error } = await client
    .from("my_concepts")
    .select(SCHEMA_COLUMNS)
    .eq("is_schema", true)
    .eq("is_relation", false)
    .in("id", schemaIds);
  if (error) {
    internalError({
      error,
      type: RESOLVE_ERROR_TYPE,
      context: { operation: RESOLVE_ERROR_OPERATION, schemaIds },
      sendEmail: false,
    });
    return new Map<number, DiscourseNode>();
  }

  const nodeTypeBySchemaId = new Map<number, DiscourseNode>();
  for (const schema of data) {
    if (schema.id === null) continue;
    try {
      const nodeType = await findOrCreateNodeType(schema);
      if (nodeType) nodeTypeBySchemaId.set(schema.id, nodeType);
    } catch (error) {
      internalError({
        error,
        type: RESOLVE_ERROR_TYPE,
        context: {
          operation: RESOLVE_ERROR_OPERATION,
          schemaId: schema.id,
          schemaName: schema.name,
        },
        sendEmail: false,
      });
    }
  }

  return nodeTypeBySchemaId;
};
