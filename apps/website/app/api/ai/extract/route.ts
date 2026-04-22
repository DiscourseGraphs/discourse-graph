import { NextRequest, NextResponse } from "next/server";
import {
  ExtractionRequestSchema,
  EXTRACTION_RESULT_JSON_SCHEMA,
  type ExtractionResponse,
  type ProviderId,
} from "~/types/extraction";
import type { LLMProviderConfig, Message, Settings } from "~/types/llm";
import {
  anthropicConfig,
  openaiConfig,
  geminiConfig,
} from "~/utils/llm/providers";
import { buildUserPrompt } from "~/prompts/extraction";
import { parseExtractionResponse } from "~/utils/ai/parseExtractionResponse";

export const runtime = "nodejs";
export const maxDuration = 300;

const PROVIDER_CONFIGS: Record<ProviderId, LLMProviderConfig> = {
  anthropic: anthropicConfig,
  openai: openaiConfig,
  gemini: geminiConfig,
};

const buildExtractionMessages = ({
  provider,
  pdfBase64,
  userPrompt,
}: {
  provider: ProviderId;
  pdfBase64: string;
  userPrompt: string;
}): Message[] => {
  switch (provider) {
    case "anthropic":
      return [
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
      ];
    case "openai":
      return [
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: "paper.pdf",
                file_data: `data:application/pdf;base64,${pdfBase64}`, // eslint-disable-line @typescript-eslint/naming-convention
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ];
    case "gemini":
      return [
        {
          role: "user",
          content: [
            {
              inlineData: {
                mimeType: "application/pdf",
                data: pdfBase64,
              },
            },
            { text: userPrompt },
          ],
        },
      ];
  }
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

  const { pdfBase64, model, provider, systemPrompt } = validated.data;

  const config = PROVIDER_CONFIGS[provider];
  const apiKey = process.env[config.apiKeyEnvVar];

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: `API key not configured for ${provider}.` },
      { status: 500 },
    );
  }

  const messages = buildExtractionMessages({
    provider,
    pdfBase64,
    userPrompt: buildUserPrompt(),
  });

  const settings: Settings = {
    model,
    maxTokens: 16384,
    temperature: 0.6,
    systemPrompt,
    outputSchema: EXTRACTION_RESULT_JSON_SCHEMA,
  };

  const apiUrl =
    typeof config.apiUrl === "function"
      ? config.apiUrl(settings)
      : config.apiUrl;

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: config.apiHeaders(apiKey),
      body: JSON.stringify(config.formatRequestBody(messages, settings)),
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
