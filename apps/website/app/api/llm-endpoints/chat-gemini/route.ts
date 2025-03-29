import { NextRequest } from "next/server";

type Message = {
  role: string;
  content: string;
};

type SafetySetting = {
  category: string;
  threshold: number;
};

type Settings = {
  model: string;
  maxTokens: number;
  temperature: number;
  safetySettings?: SafetySetting[];
};

type RequestBody = {
  documents: Message[];
  passphrase: string;
  settings: Settings;
};

type GeminiMessage = {
  role: string;
  parts: { text: string }[];
};

function convertToGeminiFormat(messages: Message[]): GeminiMessage[] {
  return messages.map(convertMessageToGeminiFormat);
}

function convertMessageToGeminiFormat(message: Message): GeminiMessage {
  return {
    role: message.role === "user" ? "user" : "model",
    parts: [{ text: message.content }],
  };
}

const DEFAULT_MODEL = "gemini-2.0-flash-exp";
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

    const modelId = model === "gemini" ? DEFAULT_MODEL : model;

    // Get API key from environment variable
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("GEMINI_API_KEY environment variable is not set");
      return createErrorResponse(
        "API key not configured. Please set the GEMINI_API_KEY environment variable in your Vercel project settings.",
        500,
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
      return createErrorResponse(
        `Gemini API error: ${responseData.error?.message || "Unknown error"}`,
        response.status,
      );
    }

    const replyText = responseData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!replyText) {
      console.error("Invalid response format from Gemini API:", responseData);
      return createErrorResponse(
        "Invalid response format from Gemini API. Check server logs for details.",
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
