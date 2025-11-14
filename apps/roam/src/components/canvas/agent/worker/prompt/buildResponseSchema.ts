import z from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { getAgentActionUtilsRecord } from "../../shared/AgentUtils";

export function buildResponseSchema() {
  const actionUtils = getAgentActionUtilsRecord();
  const actionSchemas = Object.values(actionUtils)
    .map((util) => util.getSchema())
    .filter((schema): schema is z.ZodType => schema !== null);

  if (actionSchemas.length === 0) {
    throw new Error("No action schemas found");
  }

  const actionSchema =
    actionSchemas.length === 1
      ? actionSchemas[0]!
      : z.union(actionSchemas as [z.ZodType, z.ZodType, ...z.ZodType[]]);
  const schema = z.object({
    actions: z.array(actionSchema),
  });

  return zodToJsonSchema(schema, { $refStrategy: "seen" });
}
