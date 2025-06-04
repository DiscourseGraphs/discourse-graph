import { NextResponse, NextRequest } from "next/server";

import { createClient } from "~/utils/supabase/server";
import { getOrCreateEntity, ItemValidator } from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import { TablesInsert } from "@repo/database/types.gen.ts";

type AgentIdentifierDataInput = TablesInsert<"AgentIdentifier">;

const agentIdentifierValidator: ItemValidator<AgentIdentifierDataInput> = (agent_identifier: any) => {
  if (!agent_identifier || typeof agent_identifier !== "object")
    return "Invalid request body: expected a JSON object.";
  const {
    identifier_type,
    account_id,
    value,
    trusted,
  } = agent_identifier;

  if (!['email', 'orcid'].includes(identifier_type))
    return "Invalid identifier_type";
  if (!value || typeof value !== "string" || value.trim() === "")
    return "Missing or invalid value";
  if (!account_id || Number.isNaN(Number.parseInt(account_id)))
    return "Missing or invalid account_id";
  if (trusted !== undefined && !["true", "false", true, false].includes(trusted))
    return "if included, trusted should be a boolean";

  const keys = [ 'identifier_type', 'account_id', 'value', 'trusted' ];
  if (!Object.keys(agent_identifier).every((key)=>keys.includes(key)))
    return "Invalid agent_identifier object: extra keys";
  return null;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();
    const error = agentIdentifierValidator(body);
    if (error !== null)
      return createApiResponse(request, asPostgrestFailure(error, "invalid"));

    body.account_id = Number.parseInt(body.account_id);
    body.trusted = body.trusted === true || body.trusted === "true" || false;
    const supabase = await supabasePromise;
    const result = await getOrCreateEntity<"AgentIdentifier">({
      supabase,
      tableName: "AgentIdentifier",
      insertData: body as AgentIdentifierDataInput,
      uniqueOn: ["value", "identifier_type", "account_id"],
    });

    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/agent_identifier");
  }
};

export const OPTIONS = defaultOptionsHandler;
