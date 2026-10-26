import { NextRequest, NextResponse } from "next/server";
import {
  buildTutorialUserPrompt,
  getTutorialSystemPrompt,
} from "~/prompts/obsidianTutorial";
import {
  MODEL_TUTORIAL_JSON_SCHEMA,
  ModelTutorialSchema,
  TutorialRequestSchema,
  type ModelStep,
} from "~/types/obsidianTutorial";
import cors from "~/utils/llm/cors";
import { handleOptionsRequest } from "~/utils/llm/handler";

export const runtime = "nodejs";
export const maxDuration = 120;

const MODEL = "claude-opus-5-5";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

type AnthropicResponse = {
  stop_reason?: string;
  content?: { type: string; text?: string }[];
  error?: { message?: string };
};

const jsonResponse = (
  request: NextRequest,
  body: unknown,
  status = 200,
): Response => cors(request, NextResponse.json(body, { status }));

// The plugin's TutorialStep takes block params as a map; the schema can only express a list.
const toPluginStep = (step: ModelStep) =>
  step.kind === "block"
    ? {
        ...step,
        params: Object.fromEntries(
          step.params.map(({ name, value }) => [name, value]),
        ),
      }
    : step;

const callModel = async ({
  apiKey,
  system,
  userPrompt,
}: {
  apiKey: string;
  system: string;
  userPrompt: string;
}): Promise<AnthropicResponse & { status: number }> => {
  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "server-side-fallback-2026-07-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      // The docs are identical on every request, so they sit in a cached system block.
      system: [
        {
          type: "text",
          text: system,
          cache_control: { type: "ephemeral", ttl: "1h" },
        },
      ],
      messages: [{ role: "user", content: userPrompt }],
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: MODEL_TUTORIAL_JSON_SCHEMA },
      },
      fallbacks: "default",
    }),
  });
  return { status: response.status, ...((await response.json()) as object) };
};

export const POST = async (request: NextRequest): Promise<Response> => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON body" }, 400);
  }

  const parsedRequest = TutorialRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return jsonResponse(request, { error: parsedRequest.error.message }, 400);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return jsonResponse(request, { error: "API key not configured." }, 500);
  }

  try {
    const result = await callModel({
      apiKey,
      system: await getTutorialSystemPrompt(),
      userPrompt: buildTutorialUserPrompt(parsedRequest.data),
    });
    if (result.status !== 200) {
      return jsonResponse(
        request,
        {
          error:
            result.error?.message ?? `Model request failed (${result.status})`,
        },
        502,
      );
    }
    if (result.stop_reason !== "end_turn") {
      return jsonResponse(
        request,
        { error: `Model stopped early (${result.stop_reason})` },
        502,
      );
    }

    // Thinking blocks come first on this model; the JSON is in the text block.
    const text = result.content?.find((block) => block.type === "text")?.text;
    const tutorial = ModelTutorialSchema.safeParse(JSON.parse(text ?? "null"));
    if (!tutorial.success) {
      return jsonResponse(
        request,
        { error: "Model returned an invalid tutorial" },
        502,
      );
    }

    return jsonResponse(request, {
      title: tutorial.data.title,
      steps: tutorial.data.steps.map(toPluginStep),
    });
  } catch (error) {
    return jsonResponse(
      request,
      {
        error: `Tutorial generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      500,
    );
  }
};

export const OPTIONS = handleOptionsRequest;
