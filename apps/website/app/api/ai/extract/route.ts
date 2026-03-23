import { NextRequest, NextResponse } from "next/server";
import {
  ExtractionRequestSchema,
  type ExtractionResponse,
  type ProviderId,
} from "~/types/extraction";
import {
  anthropicConfig,
  openaiConfig,
  geminiConfig,
} from "~/utils/llm/providers";
import type { LLMProviderConfig } from "~/types/llm";
import { buildUserPrompt } from "~/prompts/extraction";
import { parseExtractionResponse } from "~/utils/ai/parseExtractionResponse";

/* eslint-disable @typescript-eslint/naming-convention */

export const runtime = "nodejs";
export const maxDuration = 300;

type ExtractionParams = {
  model: string;
  systemPrompt: string;
  pdfBase64: string;
  userPrompt: string;
};

type ExtractionProviderConfig = {
  base: LLMProviderConfig;
  apiUrl: (model: string) => string;
  buildRequestBody: (params: ExtractionParams) => unknown;
  extractResponseText: (data: unknown) => string | undefined;
};

const PROVIDERS: Record<ProviderId, ExtractionProviderConfig> = {
  anthropic: {
    base: anthropicConfig,
    apiUrl: () => "https://api.anthropic.com/v1/messages",
    buildRequestBody: ({ model, systemPrompt, pdfBase64, userPrompt }) => ({
      model,
      max_tokens: 16384,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    }),
    extractResponseText: (data) =>
      anthropicConfig.extractResponseText(data) ?? undefined,
  },
  openai: {
    base: openaiConfig,
    apiUrl: () => "https://api.openai.com/v1/responses",
    buildRequestBody: ({ model, systemPrompt, pdfBase64, userPrompt }) => ({
      model,
      instructions: systemPrompt,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              filename: "paper.pdf",
              file_data: `data:application/pdf;base64,${pdfBase64}`,
            },
            { type: "input_text", text: userPrompt },
          ],
        },
      ],
      temperature: 0.2,
      max_output_tokens: 16384,
    }),
    extractResponseText: (data) => {
      const resp = data as {
        output?: {
          type: string;
          content?: { type: string; text: string }[];
        }[];
      };
      const message = resp.output?.find((o) => o.type === "message");
      return message?.content?.find((c) => c.type === "output_text")?.text;
    },
  },
  gemini: {
    base: geminiConfig,
    apiUrl: (model) => {
      const key = process.env[geminiConfig.apiKeyEnvVar];
      return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    },
    buildRequestBody: ({ systemPrompt, pdfBase64, userPrompt }) => ({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          role: "user",
          parts: [
            {
              inline_data: { mime_type: "application/pdf", data: pdfBase64 },
            },
            { text: userPrompt },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
      },
    }),
    extractResponseText: (data) =>
      geminiConfig.extractResponseText(data) ?? undefined,
  },
};

export const POST = async (
  request: NextRequest,
): Promise<NextResponse<ExtractionResponse>> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = ExtractionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.message },
      { status: 400 },
    );
  }

  const {
    pdfBase64,
    researchQuestion,
    nodeTypes,
    model,
    provider,
    systemPrompt,
  } = parsed.data;

  const config = PROVIDERS[provider];
  const apiKey = process.env[config.base.apiKeyEnvVar];

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: `API key not configured for ${provider}. Set ${config.base.apiKeyEnvVar} in environment variables.`,
      },
      { status: 500 },
    );
  }

  const userPrompt = buildUserPrompt(nodeTypes, researchQuestion);

  try {
    const response = await fetch(config.apiUrl(model), {
      method: "POST",
      headers: config.base.apiHeaders(apiKey),
      body: JSON.stringify(
        config.buildRequestBody({
          model,
          systemPrompt,
          pdfBase64,
          userPrompt,
        }),
      ),
    });

    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => null);
      const errorObj = errorData as { error?: { message?: string } } | null;
      const message =
        errorObj?.error?.message ?? `${provider} API error: ${response.status}`;
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 },
      );
    }

    const responseData: unknown = await response.json();
    const rawText = config.extractResponseText(responseData);

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: `Empty response from ${provider}` },
        { status: 502 },
      );
    }

    const result = parseExtractionResponse(rawText);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message =
      error instanceof SyntaxError
        ? "Failed to parse extraction response — invalid JSON from LLM"
        : error instanceof Error && error.name === "ZodError"
          ? "Failed to parse extraction response — unexpected JSON shape from LLM"
          : error instanceof Error
            ? `Extraction failed — ${error.message}`
            : "Extraction failed";

    console.error("AI extraction failed:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
};
