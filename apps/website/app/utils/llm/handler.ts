import { NextRequest } from "next/server";
import cors from "./cors";
import {
  CONTENT_TYPE_JSON,
  CONTENT_TYPE_TEXT,
  RequestBody,
  LLMProviderConfig,
} from "~/types/llm";

function getNestedProperty(obj: any, path: string): any {
  return path.split(".").reduce((prev, curr) => {
    return prev && prev[curr] !== undefined ? prev[curr] : undefined;
  }, obj);
}

export async function handleLLMRequest(
  request: NextRequest,
  config: LLMProviderConfig,
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

    const responseData = await response.json();

    if (!response.ok) {
      console.error(`API error:`, responseData);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: `API error: ${getNestedProperty(responseData, config.errorMessagePath) || "Unknown error"}`,
          }),
          {
            status: response.status,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    const replyText = config.extractResponseText(responseData);

    if (!replyText) {
      console.error("Invalid response format from API:", responseData);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error:
              "Invalid response format from API. Check server logs for details.",
          }),
          {
            status: 500,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    return cors(
      request,
      new Response(replyText, {
        headers: { "Content-Type": CONTENT_TYPE_TEXT },
      }),
    );
  } catch (error) {
    console.error("Error processing request:", error);
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

export async function handleOptionsRequest(
  request: NextRequest,
): Promise<Response> {
  return cors(request, new Response(null, { status: 204 }));
}
