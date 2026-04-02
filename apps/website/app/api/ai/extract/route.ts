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
import {
  DEFAULT_EXTRACTION_PROMPT,
  buildUserPrompt,
} from "~/prompts/extraction";
import { parseExtractionResponse } from "~/utils/ai/parseExtractionResponse";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 300;

type ExtractionParams = {
  model: string;
  systemPrompt: string;
  pdfBase64: string;
  userPrompt: string;
  apiKey: string;
};

type ProviderExtractionConfig = {
  apiKeyEnvVar: string;
  apiHeaders: (apiKey: string) => Record<string, string>;
  apiUrl: (params: ExtractionParams) => string;
  buildRequestBody: (params: ExtractionParams) => unknown;
  extractResponseText: (data: unknown) => string | null;
};

const openaiResponseSchema = z.object({
  output: z.array(
    z.object({
      type: z.string(),
      content: z
        .array(z.object({ type: z.string(), text: z.string() }))
        .optional(),
    }),
  ),
});

const PROVIDERS: Record<ProviderId, ProviderExtractionConfig> = {
  anthropic: {
    apiKeyEnvVar: anthropicConfig.apiKeyEnvVar,
    apiHeaders: anthropicConfig.apiHeaders,
    apiUrl: () => "https://api.anthropic.com/v1/messages",
    buildRequestBody: ({ model, systemPrompt, pdfBase64, userPrompt }) => ({
      model,
      max_tokens: 16384, // eslint-disable-line @typescript-eslint/naming-convention
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
                media_type: "application/pdf", // eslint-disable-line @typescript-eslint/naming-convention
                data: pdfBase64,
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    }),
    extractResponseText: anthropicConfig.extractResponseText,
  },
  openai: {
    apiKeyEnvVar: openaiConfig.apiKeyEnvVar,
    apiHeaders: openaiConfig.apiHeaders,
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
              file_data: `data:application/pdf;base64,${pdfBase64}`, // eslint-disable-line @typescript-eslint/naming-convention
            },
            { type: "input_text", text: userPrompt },
          ],
        },
      ],
      temperature: 0.2,
      max_output_tokens: 16384, // eslint-disable-line @typescript-eslint/naming-convention
    }),
    extractResponseText: (data: unknown) => {
      const parsed = openaiResponseSchema.safeParse(data);
      if (!parsed.success) return null;
      const message = parsed.data.output.find((o) => o.type === "message");
      return (
        message?.content?.find((c) => c.type === "output_text")?.text ?? null
      );
    },
  },
  gemini: {
    apiKeyEnvVar: geminiConfig.apiKeyEnvVar,
    apiHeaders: geminiConfig.apiHeaders,
    apiUrl: ({ apiKey, model }) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    buildRequestBody: ({ systemPrompt, pdfBase64, userPrompt }) => ({
      system_instruction: { parts: [{ text: systemPrompt }] }, // eslint-disable-line @typescript-eslint/naming-convention
      contents: [
        {
          role: "user",
          parts: [
            {
              inline_data: { mime_type: "application/pdf", data: pdfBase64 }, // eslint-disable-line @typescript-eslint/naming-convention
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
    extractResponseText: geminiConfig.extractResponseText,
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

  const validated = ExtractionRequestSchema.safeParse(body);
  if (!validated.success) {
    return NextResponse.json(
      { success: false, error: validated.error.message },
      { status: 400 },
    );
  }

  const { pdfBase64, researchQuestion, model, provider, systemPrompt } =
    validated.data;

  const config = PROVIDERS[provider];
  const apiKey = process.env[config.apiKeyEnvVar];

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: `API key not configured for ${provider}.` },
      { status: 500 },
    );
  }

  const resolvedSystemPrompt = systemPrompt ?? DEFAULT_EXTRACTION_PROMPT;
  const userPrompt = buildUserPrompt(researchQuestion);
  const params: ExtractionParams = {
    model,
    systemPrompt: resolvedSystemPrompt,
    pdfBase64,
    userPrompt,
    apiKey,
  };

  try {
    const response = await fetch(config.apiUrl(params), {
      method: "POST",
      headers: config.apiHeaders(apiKey),
      body: JSON.stringify(config.buildRequestBody(params)),
      signal: AbortSignal.timeout(270_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return NextResponse.json(
        {
          success: false,
          error: `${provider} API error (${response.status}): ${errorText.slice(0, 200)}`,
        },
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

    let result;
    try {
      result = parseExtractionResponse(rawText);
    } catch (parseError) {
      const message =
        parseError instanceof SyntaxError
          ? "LLM returned invalid JSON"
          : "LLM returned unexpected response structure";
      return NextResponse.json(
        {
          success: false,
          error: `Failed to parse extraction response — ${message}`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Extraction failed — ${error.message}`
        : "Extraction failed";
    console.error("AI extraction failed:", error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
};
