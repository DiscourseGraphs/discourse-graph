import OpenAI from "openai";
import { EmbeddingSettings, Provider } from "~/types/llm";
import { openaiConfig } from "./providers";

const OPENAI_REQUEST_TIMEOUT_MS = 30000;

const openaiEmbedding = async (
  input: string | string[],
  settings: EmbeddingSettings,
): Promise<number[] | number[][] | undefined> => {
  const config = openaiConfig;
  const apiKey = process.env[config.apiKeyEnvVar];
  if (!apiKey)
    throw new Error(
      `API key not configured. Please set the ${config.apiKeyEnvVar} environment variable in your Vercel project settings.`,
    );
  const openai = new OpenAI({ apiKey: apiKey });

  let options: OpenAI.EmbeddingCreateParams = {
    model: settings.model,
    input,
  };
  if (settings.dimensions) {
    options = { ...options, ...{ dimensions: settings.dimensions } };
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
};

export const genericEmbedding = async (
  input: string | string[],
  settings: EmbeddingSettings,
  provider: Provider = "openai",
): Promise<number[] | number[][] | undefined> => {
  if (provider == "openai") {
    return await openaiEmbedding(input, settings);
  } else {
    // Note: There are two paths here.
    // Earlier code choose to add openai to dependencies and use the library. It's what I had built on.
    // We could follow that pattern, add anthropic/gemini, and use those in the handlers as well.
    // The new code pattern uses direct api calls and structures.
    // It should not be too considerable an effort to extend the LLMProviderConfig for embeddings.
    // Either way is minimal work, but I think neither should be pursued without discussing
    // the implicit tradeoff: More dependencies vs more resilience to API changes.
    // right now I choose to minimize changes to my work to reduce scope.
    throw Error("Not implemented");
  }
};
