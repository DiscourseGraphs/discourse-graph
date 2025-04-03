import { NextRequest } from "next/server";

export type Message = {
  role: string;
  content: string;
};

export type Settings = {
  model: string;
  maxTokens: number;
  temperature: number;
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
};

export type RequestBody = {
  documents: Message[];
  passphrase?: string;
  settings: Settings;
};

export const CONTENT_TYPE_JSON = "application/json";
export const CONTENT_TYPE_TEXT = "text/plain";

export type LLMProviderConfig = {
  apiKeyEnvVar: string;
  apiUrl: string | ((settings: Settings) => string);
  apiHeaders: (apiKey: string) => Record<string, string>;
  formatRequestBody: (messages: Message[], settings: Settings) => any;
  extractResponseText: (responseData: any) => string | null;
  errorMessagePath: string;
};
