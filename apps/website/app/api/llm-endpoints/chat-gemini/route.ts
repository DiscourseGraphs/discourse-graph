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
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
};

type RequestBody = {
  documents: Message[];
  passphrase?: string;
  settings: Settings;
};

type GeminiMessage = {
  role: string;
  parts: Array<{
    text: string;
  }>;
};

const CONTENT_TYPE_JSON = "application/json";
const CONTENT_TYPE_TEXT = "text/plain";

const DEFAULT_MODEL = "gemini-2.0-flash-exp";

export const runtime = "nodejs";
export const preferredRegion = "auto";
export const maxDuration = 300;

// Convert standard messages to Gemini format
function convertToGeminiFormat(messages: Message[]): GeminiMessage[] {
  return messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Verify the bypass token
    const bypassToken = request.headers.get("x-vercel-protection-bypass");
    const expectedToken = process.env.VERCEL_PROTECTION_BYPASS;

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

    const modelId = model === "gemini" ? DEFAULT_MODEL : model;

    // Get API key from environment variable
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is not set");
      return cors(
        request,
        new Response(
          JSON.stringify({
            error:
              "API key not configured. Please set the GEMINI_API_KEY environment variable in your Vercel project settings.",
          }),
          {
            status: 500,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const body = JSON.stringify({
      contents: convertToGeminiFormat(messages),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature,
      },
      safetySettings: settings.safetySettings,
    });

    console.log(`Making request to Gemini API with model: ${modelId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": CONTENT_TYPE_JSON,
      },
      body,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", responseData);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error: `Gemini API error: ${responseData.error?.message || "Unknown error"}`,
          }),
          {
            status: response.status,
            headers: { "Content-Type": CONTENT_TYPE_JSON },
          },
        ),
      );
    }

    const replyText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      console.error("Invalid response format from Gemini API:", responseData);
      return cors(
        request,
        new Response(
          JSON.stringify({
            error:
              "Invalid response format from Gemini API. Check server logs for details.",
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
