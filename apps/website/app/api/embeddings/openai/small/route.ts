import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import cors from "~/utils/llm/cors";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error(
    "Missing OPENAI_API_KEY environment variable. The embeddings API will not function.",
  );
}

const openai = new OpenAI({ apiKey });

type RequestBody = {
  input: string | string[];
};

const OPENAI_REQUEST_TIMEOUT_MS = 30000;

export async function POST(req: NextRequest): Promise<NextResponse> {
  let response: NextResponse;

  try {
    const body: RequestBody = await req.json();
    const { input } = body;

    if (!input || (Array.isArray(input) && input.length === 0)) {
      response = NextResponse.json(
        { error: "Input text cannot be empty." },
        { status: 400 },
      );
      return cors(req, response) as NextResponse;
    }

    const options: OpenAI.EmbeddingCreateParams = {
      model: "text-embedding-3-small",
      input: input,
      encoding_format: "float",
      dimensions: 1536,
    };

    const embeddingsPromise = openai.embeddings.create(options);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("OpenAI API request timeout")),
        OPENAI_REQUEST_TIMEOUT_MS,
      ),
    );

    const openAIResponse = await Promise.race([
      embeddingsPromise,
      timeoutPromise,
    ]);

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
