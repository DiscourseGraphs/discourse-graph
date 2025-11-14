/* eslint-disable @typescript-eslint/no-explicit-any */
import { nextApiRoot } from "@repo/utils/execContext";

const API_CONFIG = {
  LLM_STREAM_URL: `${nextApiRoot()}/llm/openai/stream`,
  MODEL: "gpt-4-turbo",
  TIMEOUT_MS: 60_000,
  MAX_TOKENS: 2000,
  TEMPERATURE: 0.7,
} as const;

// A basic streaming fetch implementation
async function* streamFetch(
  url: string,
  options: RequestInit,
): AsyncGenerator<any> {
  const response = await fetch(url, options);
  if (!response.body) {
    throw new Error("Response has no body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk
        .split("\n")
        .filter((line) => line.trim().startsWith("data: "));
      for (const line of lines) {
        const jsonString = line.replace("data: ", "").trim();
        if (jsonString === "[DONE]") {
          return;
        }
        try {
          const parsed = JSON.parse(jsonString);
          yield parsed;
        } catch (e) {
          console.error("Error parsing JSON chunk:", jsonString);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class AgentService {
  async *streamCompletion(messages: any[]): AsyncGenerator<any> {
    const requestBody = {
      documents: messages,
      passphrase: "",
      settings: {
        model: API_CONFIG.MODEL,
        maxTokens: API_CONFIG.MAX_TOKENS,
        temperature: API_CONFIG.TEMPERATURE,
      },
    };

    try {
      const signal = AbortSignal.timeout(API_CONFIG.TIMEOUT_MS);
      const options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal,
      };

      yield* streamFetch(API_CONFIG.LLM_STREAM_URL, options);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        console.error("Agent streaming request timed out", error);
        yield {
          choices: [
            {
              delta: {
                content:
                  "Error: Request timed out. Please try again or check your connection.",
              },
            },
          ],
        };
      } else {
        console.error("Agent streaming request failed:", error);
        yield {
          choices: [
            {
              delta: {
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            },
          ],
        };
      }
    }
  }
}
