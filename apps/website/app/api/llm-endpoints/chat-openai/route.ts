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

type RequestBody = {
  documents: Message[];
  passphrase?: string;
  settings: Settings;
};

const CONTENT_TYPE_JSON = "application/json";
const CONTENT_TYPE_TEXT = "text/plain";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Verify the bypass token
    const bypassToken = request.headers.get("x-vercel-protection-bypass");
    const expectedToken = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

    // Only check token if it's set in environment variables
    if (expectedToken && bypassToken !== expectedToken) {
      return cors(
        request,
        new Response(JSON.stringify({ error: "Unauthorized access" }), {
          status: 401,
          headers: { "Content-Type": CONTENT_TYPE_JSON },
        }),
      );
    }
    const requestData: RequestBody = await request.json();
    const { documents: messages, settings } = requestData;
    const { model, maxTokens, temperature } = settings;

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY environment variable is not set");
      return cors(
        request,
        new Response(
          JSON.stringify({
            error:
              "API key not configured. Please set the OPENAI_API_KEY environment variable in your Vercel project settings.",
          }),
          {
            status: 500,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    const url = "https://api.openai.com/v1/chat/completions";

    const body = JSON.stringify({
      model: model,
      messages: messages,
      ...(temperature !== undefined && {
        temperature: temperature,
        max_tokens: maxTokens,
      }),
    });

    console.log(`Making request to OpenAI API with model: ${model}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": CONTENT_TYPE_JSON,
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", responseData);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: `OpenAI API error: ${responseData.error?.message || "Unknown error"}`,
          }),
          {
            status: response.status,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    const replyText = responseData.choices?.[0]?.message?.content;

    if (!replyText) {
      console.error("Invalid response format from OpenAI API:", responseData);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error:
              "Invalid response format from OpenAI API. Check server logs for details.",
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
