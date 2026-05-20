import { NextResponse, NextRequest } from "next/server";

import { createClient } from "~/utils/supabase/server";
import { getOrCreateEntity } from "~/utils/supabase/dbUtils";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { type TablesInsert, Constants } from "@repo/database/dbTypes";

type AgentIdentifierDataInput = TablesInsert<"AgentIdentifier">;
// eslint-disable-next-line @typescript-eslint/naming-convention
const { AgentIdentifierType } = Constants.public.Enums;

// ItemValidator<"AgentIdentifier">
const agentIdentifierValidator = (
  // eslint-disable-next-line @typescript-eslint/naming-convention
  agent_identifier: AgentIdentifierDataInput,
): string | null => {
  if (!agent_identifier || typeof agent_identifier !== "object")
    return "Invalid request body: expected a JSON object.";
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { identifier_type, account_id, value, trusted } = agent_identifier;

  if (!AgentIdentifierType.includes(identifier_type))
    return "Invalid identifier_type";
  if (!value || typeof value !== "string" || value.trim() === "")
    return "Missing or invalid value";
  if (!account_id || typeof account_id !== "number" || Number.isNaN(account_id))
    return "Missing or invalid account_id";
  if (trusted !== undefined && typeof trusted !== "boolean")
    return "if included, trusted should be a boolean";

  const keys = ["identifier_type", "account_id", "value", "trusted"];
  if (!Object.keys(agent_identifier).every((key) => keys.includes(key)))
    return "Invalid agent_identifier object: extra keys";
  return null;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = (await request.json()) as AgentIdentifierDataInput;
    const error = agentIdentifierValidator(body);
    if (error !== null)
      return createApiResponse(request, asPostgrestFailure(error, "invalid"));

    const supabase = await supabasePromise;
    const result = await getOrCreateEntity({
      supabase,
      tableName: "AgentIdentifier",
      insertData: body,
      uniqueOn: ["value", "identifier_type", "account_id"],
    });

    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/agent-identifier");
  }
};

export const OPTIONS = defaultOptionsHandler;
