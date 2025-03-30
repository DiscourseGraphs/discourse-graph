import { NextRequest } from "next/server";

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
  passphrase: string;
  settings: Settings;
};

const CONTENT_TYPE_JSON = "application/json";
const CONTENT_TYPE_TEXT = "text/plain";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const requestData: RequestBody = await request.json();
    const { documents: messages, settings } = requestData;
    const { model, maxTokens, temperature } = settings;

    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY environment variable is not set");
      return createErrorResponse(
        "API key not configured. Please set the OPENAI_API_KEY environment variable in your Vercel project settings.",
        500,
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
      return createErrorResponse(
        `OpenAI API error: ${responseData.error?.message || "Unknown error"}`,
        response.status,
      );
    }

    const replyText = responseData.choices?.[0]?.message?.content;

    if (!replyText) {
      console.error("Invalid response format from OpenAI API:", responseData);
      return createErrorResponse(
        "Invalid response format from OpenAI API. Check server logs for details.",
        500,
      );
    }

    return new Response(replyText, {
      headers: { "Content-Type": CONTENT_TYPE_TEXT },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    return createErrorResponse(
      `Internal Server Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      500,
    );
  }
}

function createErrorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": CONTENT_TYPE_JSON },
  });
}
