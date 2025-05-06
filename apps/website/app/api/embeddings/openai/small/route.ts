import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import cors from "~/utils/llm/cors";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RequestBody = {
  input: string | string[];
  model?: string;
  dimensions?: number;
  encoding_format?: "float" | "base64";
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let response: NextResponse;

  try {
    if (req.method === "OPTIONS") {
      return cors(req, new NextResponse(null, { status: 204 })) as NextResponse;
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
      return cors(req, response) as NextResponse;
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
  } catch (error: unknown) {
    console.error("Error calling OpenAI Embeddings API:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    response = NextResponse.json(
      {
        error: "Failed to generate embeddings.",
        details: errorMessage,
      },
      { status: 500 },
    );
  }

  return cors(req, response) as NextResponse;
}

export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  return cors(req, new NextResponse(null, { status: 204 })) as NextResponse;
}
