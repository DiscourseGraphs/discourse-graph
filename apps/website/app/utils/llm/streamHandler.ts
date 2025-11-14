import { NextRequest } from "next/server";
import cors from "./cors";
import {
  CONTENT_TYPE_JSON,
  RequestBody,
  LLMStreamingProviderConfig,
} from "~/types/llm";

export async function handleOptionsRequest(
  request: NextRequest,
): Promise<Response> {
  return cors(request, new Response(null, { status: 204 }));
}

export async function handleLLMStreamRequest(
  request: NextRequest,
  config: LLMStreamingProviderConfig,
): Promise<Response> {
  try {
    const requestData: RequestBody = await request.json();
    const { documents: messages, settings } = requestData;

    const apiKey = process.env[config.apiKeyEnvVar];

    if (!apiKey) {
      console.error(`${config.apiKeyEnvVar} environment variable is not set`);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: `API key not configured. Please set the ${config.apiKeyEnvVar} environment variable in your Vercel project settings.`,
          }),
          {
            status: 500,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    const body = JSON.stringify(config.formatRequestBody(messages, settings));

    const apiUrl =
      typeof config.apiUrl === "function"
        ? config.apiUrl(settings)
        : config.apiUrl;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: config.apiHeaders(apiKey),
      body,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`API error:`, errorData);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: `API error: ${errorData?.error?.message || "Unknown error"}`,
          }),
          {
            status: response.status,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    if (!response.body) {
      console.error("Response has no body");
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: "Response has no body",
          }),
          {
            status: 500,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    // Return streaming response
    return cors(
      request,
      new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
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
          headers: { "Content-Type": CONTENT_TYPE_JSON },
        },
      ),
    );
  }
}
