import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import cors from "~/utils/llm/cors";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error(
    "Missing OPENAI_API_KEY environment variable. The embeddings API will not function.",
  );
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

type RequestBody = {
  input: string | string[];
  model?: string;
  dimensions?: number;
  encoding_format?: "float" | "base64";
};

const OPENAI_REQUEST_TIMEOUT_MS = 30000;

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  let response: NextResponse;

  if (!apiKey) {
    response = NextResponse.json(
      {
        error: "Server configuration error.",
        details: "Embeddings service is not configured.",
      },
      { status: 500 },
    );
    return cors(req, response) as NextResponse;
  }

  try {
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
      model,
      input,
      dimensions,
      encoding_format,
    };

    const embeddingsPromise = openai!.embeddings.create(options);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("OpenAI API request timeout")),
        OPENAI_REQUEST_TIMEOUT_MS,
      ),
    );

    const openAIResponse = (await Promise.race([
      embeddingsPromise,
      timeoutPromise,
    ])) as OpenAI.CreateEmbeddingResponse;

    response = NextResponse.json(openAIResponse, { status: 200 });
  } catch (error: unknown) {
    console.error("Error calling OpenAI Embeddings API:", error);
    const errorMessage =
      process.env.NODE_ENV === "development"
        ? error instanceof Error
          ? error.message
          : "Unknown error"
        : "Internal server error";
    response = NextResponse.json(
      {
        error: "Failed to generate embeddings.",
        details: errorMessage,
      },
      { status: 500 },
    );
  }

  return cors(req, response) as NextResponse;
};

export const OPTIONS = async (req: NextRequest): Promise<NextResponse> => {
  return cors(req, new NextResponse(null, { status: 204 })) as NextResponse;
};
