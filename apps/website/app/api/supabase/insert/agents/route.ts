import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";

type AgentDataInput = {
  type: string;
};

type AgentRecord = {
  id: number;
  type: string;
};

const getOrCreateAgentByType = async (
  supabasePromise: ReturnType<typeof createClient>,
  agentType: string,
): Promise<GetOrCreateEntityResult<AgentRecord>> => {
  const type = agentType.trim();

  if (!type) {
    return {
      entity: null,
      error: "Missing or invalid 'type' for Agent.",
      details: "Agent 'type' is required and cannot be empty.",
      created: false,
      status: 400,
    };
  }

  const supabase = await supabasePromise;

  return getOrCreateEntity<AgentRecord>(
    supabase,
    "Agent",
    "id, type",
    { type: type },
    { type: type },
    "Agent",
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: AgentDataInput = await request.json();
    const { type } = body;

    if (!type || typeof type !== "string" || type.trim() === "") {
      return createApiResponse(request, {
        error: "Validation Error: Missing or invalid type for Agent.",
        status: 400,
      });
    }

    const result = await getOrCreateAgentByType(supabasePromise, type);

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/agents");
  }
};

export const OPTIONS = defaultOptionsHandler;
