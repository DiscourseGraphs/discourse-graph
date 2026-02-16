import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NODE_TYPES } from "~/types/extraction";
import type { ExtractionResponse } from "~/types/extraction";
import { EXTRACTION_SYSTEM_PROMPT, buildUserPrompt } from "~/utils/ai/prompts";
import { parseExtractionResponse } from "~/utils/ai/parseExtractionResponse";

export const runtime = "nodejs";
export const maxDuration = 300;

// eslint-disable-next-line @typescript-eslint/naming-convention
const RequestSchema = z.object({
  paperText: z.string().min(1),
  researchQuestion: z.string().optional(),
  nodeTypes: z.array(z.enum(NODE_TYPES)).min(1),
  model: z.string().min(1),
});

const stripControlCharacters = ({ text }: { text: string }): string => {
  return Array.from(text)
    .filter((character) => {
      const code = character.charCodeAt(0);
      const isAllowedWhitespace = code === 9 || code === 10 || code === 13;
      const isControl = (code >= 0 && code <= 31) || code === 127;
      return !isControl || isAllowedWhitespace;
    })
    .join("");
};

const normalizePaperText = ({ paperText }: { paperText: string }): string => {
  const cleaned = stripControlCharacters({ text: paperText })
    .replace(/[^\S\r\n]+/g, " ")
    .trim();
  const maxChars = 180_000;
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;
};

const isZodErrorLike = (value: unknown): value is { issues: unknown[] } => {
  return (
    typeof value === "object" &&
    value !== null &&
    "issues" in value &&
    Array.isArray((value as { issues: unknown[] }).issues)
  );
};

const getExtractionErrorMessage = (error: unknown): string => {
  if (isZodErrorLike(error)) {
    return "Failed to parse extraction response — the LLM returned an unexpected JSON shape";
  }

  if (error instanceof SyntaxError) {
    return "Failed to parse extraction response — invalid JSON";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return `Extraction failed — ${error.message}`;
  }

  return "Extraction failed";
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const POST = async (
  request: NextRequest,
): Promise<NextResponse<ExtractionResponse>> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "Anthropic API key not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.message },
      { status: 400 },
    );
  }

  const { paperText, researchQuestion, nodeTypes, model } = parsed.data;
  const normalizedPaperText = normalizePaperText({ paperText });
  const userPrompt = buildUserPrompt(
    normalizedPaperText,
    nodeTypes,
    researchQuestion,
  );

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      /* eslint-disable @typescript-eslint/naming-convention */
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        /* eslint-enable @typescript-eslint/naming-convention */
        temperature: 0.2,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const message =
        errorData?.error?.message ?? `Anthropic API error: ${response.status}`;
      return NextResponse.json(
        { success: false, error: message },
        { status: 502 },
      );
    }

    const data = (await response.json()) as {
      content?: { type: string; text: string }[];
    };
    const rawText = data.content?.[0]?.text;

    if (!rawText) {
      return NextResponse.json(
        { success: false, error: "Empty response from Anthropic" },
        { status: 502 },
      );
    }

    const result = parseExtractionResponse(rawText);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = getExtractionErrorMessage(error);
    console.error("AI extraction failed", error);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
};
