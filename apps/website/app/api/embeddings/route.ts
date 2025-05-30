import { NextRequest, NextResponse } from "next/server";
import cors from "~/utils/llm/cors";
import { genericEmbedding } from "~/utils/llm/embeddings";
import { EmbeddingSettings, Provider } from "~/types/llm";

type RequestBody = {
  input: string | string[];
  settings: EmbeddingSettings;
  provider?: Provider;
};

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  let response: NextResponse;

  try {
    const body: RequestBody = await req.json();
    const { input, settings, provider = "openai" } = body;

    if (!input || (Array.isArray(input) && input.length === 0)) {
      response = NextResponse.json(
        { error: "Input text cannot be empty." },
        { status: 400 },
      );
      return cors(req, response) as NextResponse;
    }

    const embeddings = await genericEmbedding(input, settings, provider);
    if (embeddings === undefined)
      response = NextResponse.json(
        {
          error: "Failed to generate embeddings.",
        },
        { status: 500 },
      );
    else response = NextResponse.json(embeddings, { status: 200 });
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
