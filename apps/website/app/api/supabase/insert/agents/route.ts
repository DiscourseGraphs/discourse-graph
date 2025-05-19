import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";

const AgentDataInputSchema = z.object({
  type: z.string().trim().min(1, { message: "Agent type cannot be empty." }),
});

type AgentRecord = {
  id: number;
  type: string;
};

const getOrCreateAgentByType = async (
  supabasePromise: ReturnType<typeof createClient>,
  agentType: string,
): Promise<GetOrCreateEntityResult<AgentRecord>> => {
  const type = agentType.trim();

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
    const body = await request.json();

    const validationResult = AgentDataInputSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join(".")} - ${e.message}`)
        .join("; ");
      return createApiResponse(request, {
        error: "Validation Error",
        details: errorMessages,
        status: 400,
      });
    }

    const { type } = validationResult.data;

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
