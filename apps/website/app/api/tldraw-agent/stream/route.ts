import { NextRequest } from "next/server";
import { AgentPrompt } from "../../../../../roam/src/components/canvas/agent/shared/types/AgentPrompt";
import { AgentService } from "../lib/AgentStreamingService";
import { Environment } from "../lib/environment";
import cors from "~/utils/llm/cors";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

const createAgentService = (): AgentService => {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!openaiApiKey) {
    throw new Error("Missing required API key. OPENAI_API_KEY must be set.");
  }

  // Anthropic is optional since we default to OpenAI
  return new AgentService({
    OPENAI_API_KEY: openaiApiKey,
    ANTHROPIC_API_KEY: anthropicApiKey || "",
  } as Environment);
};

export const POST = async (request: NextRequest): Promise<Response> => {
  try {
    const prompt: AgentPrompt = await request.json();
    const agentService = createAgentService();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of agentService.stream(prompt)) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(new TextEncoder().encode(data));
          }
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
            // Extract more details from AI SDK errors
            if (
              "responseBody" in error &&
              typeof error.responseBody === "string"
            ) {
              try {
                const errorBody = JSON.parse(error.responseBody);
                if (errorBody.error?.message) {
                  errorMessage = errorBody.error.message;
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
          const errorData = `data: ${JSON.stringify({ error: errorMessage })}\n\n`;
          controller.enqueue(new TextEncoder().encode(errorData));
          controller.close();
        }
      },
    });

    return cors(
      request,
      new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      }),
    );
  } catch (error) {
    console.error("Error processing streaming request:", error);
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: `Internal Server Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }
};

export const OPTIONS = async (request: NextRequest): Promise<Response> => {
  return cors(request, new Response(null, { status: 204 }));
};
