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
  provider?: string;
  encoding_format?: "float" | "base64";
};

const OPENAI_REQUEST_TIMEOUT_MS = 30000;

async function openai_embedding(
  input: string | string[],
  model: string,
  dimensions?: number,
): Promise<number[] | number[][] | undefined> {
  let options: OpenAI.EmbeddingCreateParams = {
    model,
    input,
  };
  if (dimensions) {
    options = { ...options, ...{ dimensions } };
  }

  const embeddingsPromise = openai!.embeddings.create(options);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("OpenAI API request timeout")),
      OPENAI_REQUEST_TIMEOUT_MS,
    ),
  );

  const response = await Promise.race([embeddingsPromise, timeoutPromise]);
  const embeddings = response.data.map((d) => d.embedding);
  if (Array.isArray(input)) return embeddings;
  else return embeddings[0];
}

export async function generic_embedding(
  input: string | string[],
  model: string,
  provider: string,
  dimensions?: number,
): Promise<number[] | number[][] | undefined> {
  provider = provider || "openai";
  if (provider == "openai") {
    return await openai_embedding(input, model, dimensions);
  }
}

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
      provider = "openai",
    } = body;

    if (!input || (Array.isArray(input) && input.length === 0)) {
      response = NextResponse.json(
        { error: "Input text cannot be empty." },
        { status: 400 },
      );
      return cors(req, response) as NextResponse;
    }

    const embeddings = await generic_embedding(
      input,
      model,
      provider,
      dimensions,
    );
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
