import { NextRequest } from "next/server";
import cors from "~/utils/llm/cors";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

const encoder = new TextEncoder();

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Dynamic import to avoid pulling in React/tldraw at module load time
    const { AgentStreamingService } = await import(
      "../lib/AgentStreamingService"
    );

    let prompt: any;

    try {
      prompt = await request.json();
    } catch (error) {
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: `Invalid request body: ${
              error instanceof Error ? error.message : "unknown error"
            }`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    }

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const service = new AgentStreamingService();
          for await (const change of service.stream(prompt)) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(change)}\n\n`),
            );
          }
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return cors(
      request,
      new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      }),
    );
  } catch (error) {
    console.error("Failed to handle tldraw-agent request:", error);
    return cors(
      request,
      new Response(
        JSON.stringify({
          error: `Server error: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
  }
}

export function OPTIONS(request: NextRequest): Response {
  return cors(request, new Response(null, { status: 204 }));
}
