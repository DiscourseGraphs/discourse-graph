/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSetting } from "~/utils/extensionSettings";

const OPENAI_API_KEY_SETTING = "openai-api-key";

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
  private getApiKey(): string | null {
    // In a real app, you'd want to securely store and retrieve this key.
    // For this example, we'll try to get it from extension settings.
    const key = getSetting(OPENAI_API_KEY_SETTING);
    if (key) {
      return key;
    }

    // You can also fallback to an environment variable for local development
    if (process.env.NODE_ENV === "development") {
      // Remember to add OPENAI_API_KEY to your .env file for this to work
      return process.env.OPENAI_API_KEY ?? null;
    }

    return null;
  }

  async *streamCompletion(messages: any[]): AsyncGenerator<any> {
    const apiKey = this.getApiKey();

    if (!apiKey) {
      yield {
        choices: [
          {
            delta: {
              content:
                "OpenAI API key is not set. Please set it in the extension settings.",
            },
          },
        ],
      };
      return;
    }

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4-turbo", // Or any other suitable model
        messages,
        stream: true,
      }),
    };

    yield* streamFetch("https://api.openai.com/v1/chat/completions", options);
  }
}
