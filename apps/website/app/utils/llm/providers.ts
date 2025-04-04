import { LLMProviderConfig, Message, Settings } from "../../types/llm";

export const openaiConfig: LLMProviderConfig = {
  apiKeyEnvVar: "OPENAI_API_KEY",
  apiUrl: "https://api.openai.com/v1/chat/completions",
  apiHeaders: (apiKey: string) => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  }),
  formatRequestBody: (messages: Message[], settings: Settings) => ({
    model: settings.model,
    messages: messages,
    temperature: settings.temperature,
    max_completion_tokens: settings.maxTokens,
  }),
  extractResponseText: (responseData: any) =>
    responseData.choices?.[0]?.message?.content,
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
      parts: [{ text: msg.content }],
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
    messages: messages,
    temperature: settings.temperature,
  }),
  extractResponseText: (responseData: any) => responseData.content?.[0]?.text,
  errorMessagePath: "error?.message",
};
