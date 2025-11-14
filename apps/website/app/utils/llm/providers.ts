import {
  LLMProviderConfig,
  LLMStreamingProviderConfig,
  Message,
  MessageContentPart,
  Settings,
} from "~/types/llm";

type RecordLike = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordLike => {
  return typeof value === "object" && value !== null;
};

const extractOpenAIMessageText = (message: unknown): string | null => {
  if (!isRecord(message)) return null;
  const { content } = message as { content?: unknown };
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(content)) {
    const combined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (isRecord(part)) {
          if (typeof part.text === "string") return part.text;
          if (typeof part.content === "string") return part.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n\n")
      .trim();
    return combined.length > 0 ? combined : null;
  }
  return null;
};

const messageContentToString = (content: Message["content"]): string => {
  if (typeof content === "string") {
    return content;
  }

  return content
    .map((part) => extractTextFromContentPart(part))
    .filter(Boolean)
    .join("\n\n")
    .trim();
};

const extractTextFromContentPart = (part: MessageContentPart): string => {
  if ("text" in part && typeof part.text === "string") {
    return part.text;
  }
  return "";
};

export const openaiConfig: LLMProviderConfig = {
  apiKeyEnvVar: "OPENAI_API_KEY",
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiHeaders: (apiKey: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }),
  formatRequestBody: (messages: Message[], settings: Settings) => ({
    model: settings.model,
    messages,
    temperature: settings.temperature,
    max_completion_tokens: settings.maxTokens,
  }),
  extractResponseText: (responseData: any) => {
    return extractOpenAIMessageText(responseData.choices[0].message);
  },
  errorMessagePath: "error?.message",
};

export const geminiConfig: LLMProviderConfig = {
  apiKeyEnvVar: "GEMINI_API_KEY",
  apiUrl: (settings: Settings) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
  apiHeaders: () => ({
    "Content-Type": "application/json",
  }),
  formatRequestBody: (messages: Message[], settings: Settings) => ({
    contents: messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: messageContentToString(msg.content) }],
    })),
    generationConfig: {
      maxOutputTokens: settings.maxTokens,
      temperature: settings.temperature,
    },
    safetySettings: settings.safetySettings,
  }),
  extractResponseText: (responseData: any) =>
    responseData.candidates?.[0]?.content?.parts?.[0]?.text,
  errorMessagePath: "error?.message",
};

export const anthropicConfig: LLMProviderConfig = {
  apiKeyEnvVar: "ANTHROPIC_API_KEY",
  apiUrl: "https://api.anthropic.com/v1/messages",
  apiHeaders: (apiKey: string) => ({
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  }),
  formatRequestBody: (messages: Message[], settings: Settings) => ({
    model: settings.model,
    max_tokens: settings.maxTokens,
    messages,
    temperature: settings.temperature,
  }),
  extractResponseText: (responseData: any) => responseData.content?.[0]?.text,
  errorMessagePath: "error?.message",
};

export const openaiStreamingConfig: LLMStreamingProviderConfig = {
  apiKeyEnvVar: "OPENAI_API_KEY",
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiHeaders: (apiKey: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }),
  formatRequestBody: (messages: Message[], settings: Settings) => {
    const body: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_completion_tokens: settings.maxTokens,
      stream: true,
    };

    // Add response_format if specified (OpenAI JSON mode)
    if (settings.responseFormat) {
      body.response_format = settings.responseFormat;
    }

    return body;
  },
  errorMessagePath: "error?.message",
};
