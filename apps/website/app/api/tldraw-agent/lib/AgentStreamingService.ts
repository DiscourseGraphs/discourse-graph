import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { streamText } from "ai";

// Server-safe type definitions to avoid importing React/tldraw
type Streaming<T> = T & { complete: boolean; time: number };
import {
  AgentModelName,
  getAgentModelDefinition,
} from "../../../../../roam/src/components/canvas/agent/worker/models";
import { closeAndParseJson } from "./do/closeAndParseJson";
import { buildMessagesServer } from "./prompt/buildMessagesServer";
import { buildSystemPromptServer } from "./prompt/buildSystemPromptServer";
import { getModelNameServer } from "./prompt/getModelNameServer";

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw new Error("OPENAI_API_KEY is not configured");
}

const openai = createOpenAI({ apiKey: openaiApiKey });

export class AgentStreamingService {
  async *stream(prompt: any): AsyncGenerator<Streaming<any>> {
    const modelName = getModelNameServer(prompt);
    const model = getModel(modelName);
    yield* streamActions(model, prompt);
  }
}

function getModel(modelName: AgentModelName): LanguageModel {
  const modelDefinition = getAgentModelDefinition(modelName);
  if (modelDefinition.provider !== "openai") {
    throw new Error(`Model ${modelName} is not supported yet`);
  }
  return openai(modelDefinition.id);
}

async function* streamActions(
  model: LanguageModel,
  prompt: any,
): AsyncGenerator<Streaming<any>> {
  if (typeof model === "string") {
    throw new Error("Model is not configured correctly");
  }

  const messages = buildMessagesServer(prompt);
  const systemPrompt = buildSystemPromptServer(prompt);

  // Force the model to start emitting the JSON payload immediately
  messages.push({
    role: "assistant",
    content: [
      {
        type: "text",
        text: '{"actions": [{"_type":',
      },
    ],
  });

  const result = await streamText({
    model,
    system: systemPrompt,
    messages,
    maxOutputTokens: 8_192,
    temperature: 0,
  });

  let buffer = '{"actions": [{"_type":';
  let cursor = 0;
  let maybeIncompleteAction: any | null = null;
  let startTime = Date.now();

  for await (const text of result.textStream) {
    buffer += text;

    const partialObject = closeAndParseJson(buffer);
    if (!partialObject) continue;

    const actions = partialObject.actions;
    if (!Array.isArray(actions) || actions.length === 0) continue;

    if (actions.length > cursor) {
      const action = actions[cursor - 1] as any | undefined;
      if (action) {
        yield {
          ...action,
          complete: true,
          time: Date.now() - startTime,
        };
        maybeIncompleteAction = null;
      }
      cursor++;
    }

    const nextAction = actions[cursor - 1] as any | undefined;
    if (nextAction) {
      if (!maybeIncompleteAction) {
        startTime = Date.now();
      }
      maybeIncompleteAction = nextAction;
      yield {
        ...nextAction,
        complete: false,
        time: Date.now() - startTime,
      };
    }
  }

  if (maybeIncompleteAction) {
    yield {
      ...maybeIncompleteAction,
      complete: true,
      time: Date.now() - startTime,
    };
  }
}
