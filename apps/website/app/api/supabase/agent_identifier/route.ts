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
  } = agent_identifier;

  if (!(identifier_type in ['email', 'orcid']))
    return "Invalid identifier_type";
  if (!value || typeof value !== "string" || value.trim() === "")
    return "Missing or invalid value";
  if (!account_id || typeof account_id !== "number")
    return "Missing or invalid account_id";
  return null;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();
    const error = agentIdentifierValidator(body);
    if (error !== null)
      return createApiResponse(request, asPostgrestFailure(error, "invalid"));

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
