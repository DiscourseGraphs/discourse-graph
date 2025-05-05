import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import cors from "~/utils/llm/cors";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RequestBody {
  input: string | string[];
  model?: string;
  dimensions?: number;
  encoding_format?: "float" | "base64";
}

export async function POST(req: NextRequest) {
  let response: NextResponse;

  try {
    if (req.method === "OPTIONS") {
      return cors(req, new Response(null, { status: 204 }));
    }

    const body: RequestBody = await req.json();
    const {
      input,
      model = "text-embedding-3-small",
      dimensions,
      encoding_format = "float",
    } = body;

    if (!input || (Array.isArray(input) && input.length === 0)) {
      response = NextResponse.json(
        { error: "Input text cannot be empty." },
        { status: 400 },
      );
      return cors(req, response);
    }

    const options: OpenAI.EmbeddingCreateParams = {
      model: model,
      input: input,
      encoding_format: encoding_format,
    };

    if (dimensions && model.startsWith("text-embedding-3")) {
      options.dimensions = dimensions;
    }

    const openAIResponse = await openai.embeddings.create(options);

    response = NextResponse.json(openAIResponse, { status: 200 });
  } catch (error: any) {
    console.error("Error calling OpenAI Embeddings API:", error);
    response = NextResponse.json(
      {
        error: "Failed to generate embeddings.",
        details: error.message || "Unknown error",
      },
      { status: 500 },
    );
  }

  return cors(req, response);
}

export async function OPTIONS(req: NextRequest) {
  return cors(req, new Response(null, { status: 204 }));
}
