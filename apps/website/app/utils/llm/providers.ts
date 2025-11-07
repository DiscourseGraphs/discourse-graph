import { LLMProviderConfig, Message, Settings } from "~/types/llm";

const HEADER_CONTENT_TYPE = "Content-Type";
const HEADER_AUTHORIZATION = "Authorization";
const HEADER_X_API_KEY = "x-api-key";
const HEADER_ANTHROPIC_VERSION = "anthropic-version";
const BODY_MAX_COMPLETION_TOKENS = "max_completion_tokens";
const BODY_MAX_TOKENS = "max_tokens";

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

export const openaiConfig: LLMProviderConfig = {
  apiKeyEnvVar: "OPENAI_API_KEY",
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiHeaders: (apiKey: string) => ({
    [HEADER_CONTENT_TYPE]: "application/json",
    [HEADER_AUTHORIZATION]: `Bearer ${apiKey}`,
  }),
  formatRequestBody: (messages: Message[], settings: Settings) => ({
    model: settings.model,
    messages,
    temperature: settings.temperature,
    [BODY_MAX_COMPLETION_TOKENS]: settings.maxTokens,
  }),
  extractResponseText: (responseData: unknown) => {
    if (!isRecord(responseData)) return null;
    const choices = responseData.choices;
    if (!Array.isArray(choices) || choices.length === 0) return null;
    const firstChoice = choices[0];
    if (!isRecord(firstChoice)) return null;
    return extractOpenAIMessageText(firstChoice.message);
  },
  errorMessagePath: "error?.message",
};

export const geminiConfig: LLMProviderConfig = {
  apiKeyEnvVar: "GEMINI_API_KEY",
  apiUrl: (settings: Settings) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${settings.model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
  apiHeaders: () => ({
    [HEADER_CONTENT_TYPE]: "application/json",
  }),
  formatRequestBody: (messages: Message[], settings: Settings) => ({
    contents: messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    })),
    generationConfig: {
      maxOutputTokens: settings.maxTokens,
      temperature: settings.temperature,
    },
    safetySettings: settings.safetySettings,
  }),
  extractResponseText: (responseData: unknown) => {
    if (!isRecord(responseData)) return null;
    const candidates = responseData.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const candidate = candidates[0];
    if (!isRecord(candidate)) return null;
    const content = candidate.content;
    if (!isRecord(content)) return null;
    const parts = content.parts;
    if (!Array.isArray(parts) || parts.length === 0) return null;
    const firstPart = parts[0];
    if (isRecord(firstPart) && typeof firstPart.text === "string") {
      return firstPart.text;
    }
    return null;
  },
  errorMessagePath: "error?.message",
};

export const anthropicConfig: LLMProviderConfig = {
  apiKeyEnvVar: "ANTHROPIC_API_KEY",
  apiUrl: "https://api.anthropic.com/v1/messages",
  apiHeaders: (apiKey: string) => ({
    [HEADER_CONTENT_TYPE]: "application/json",
    [HEADER_X_API_KEY]: apiKey,
    [HEADER_ANTHROPIC_VERSION]: "2023-06-01",
  }),
  formatRequestBody: (messages: Message[], settings: Settings) => ({
    model: settings.model,
    [BODY_MAX_TOKENS]: settings.maxTokens,
    messages,
    temperature: settings.temperature,
  }),
  extractResponseText: (responseData: unknown) => {
    if (!isRecord(responseData)) return null;
    const content = responseData.content;
    if (!Array.isArray(content) || content.length === 0) return null;
    const firstItem = content[0];
    if (isRecord(firstItem) && typeof firstItem.text === "string") {
      return firstItem.text;
    }
    return null;
  },
  errorMessagePath: "error?.message",
};
