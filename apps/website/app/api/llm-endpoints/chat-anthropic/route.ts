import { NextRequest } from "next/server";
import cors from "../../../../lib/cors";

type Message = {
  role: string;
  content: string;
};

type Settings = {
  model: string;
  maxTokens: number;
  temperature: number;
};

type AnthropicUsage = {
  input_tokens: number;
  output_tokens: number;
};

type RequestBody = {
  documents: Message[];
  passphrase?: string;
  settings: Settings;
};

const CONTENT_TYPE_JSON = "application/json";
const CONTENT_TYPE_TEXT = "text/plain";
const ANTHROPIC_API_VERSION = "2023-06-01";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const requestData: RequestBody = await request.json();
    const { documents: messages, settings } = requestData;
    const { model, maxTokens, temperature } = settings;

    // Get API key from environment variable
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY environment variable is not set");
      return cors(
        request,
        new Response(
          JSON.stringify({
            error:
              "API key not configured. Please set the ANTHROPIC_API_KEY environment variable in your Vercel project settings.",
          }),
          {
            status: 500,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    const url = "https://api.anthropic.com/v1/messages";

    const body = JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      messages: messages,
      temperature: temperature,
    });

    console.log(`Making request to Anthropic API with model: ${model}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": CONTENT_TYPE_JSON,
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", responseData);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: `Anthropic API error: ${responseData.error?.message || "Unknown error"}`,
          }),
          {
            status: response.status,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    // Log token usage information
    const usage: AnthropicUsage = responseData.usage;
    if (usage) {
      const inputTokens = usage.input_tokens;
      const outputTokens = usage.output_tokens;
      const totalTokens = inputTokens + outputTokens;

      console.log(
        `input-token: ${inputTokens}, output-token: ${outputTokens}, total-token: ${totalTokens}`,
      );
    }

    console.log(
      `status: ${response.status} -- ${responseData.error || ""} -- ${
        responseData.stop_reason || ""
      } -- ${responseData.content?.[0]?.text || ""}`,
    );

    // Extract the response text
    const replyText = responseData.content?.[0]?.text;

    if (!replyText) {
      console.error(
        "Invalid response format from Anthropic API:",
        responseData,
      );
      return cors(
        request,
        new Response(
          JSON.stringify({
            error:
              "Invalid response format from Anthropic API. Check server logs for details.",
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

export async function OPTIONS(request: NextRequest) {
  return cors(request, new Response(null, { status: 204 }));
}
