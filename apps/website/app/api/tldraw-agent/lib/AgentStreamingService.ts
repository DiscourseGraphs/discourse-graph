import { AnthropicProvider, createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI, OpenAIProvider } from "@ai-sdk/openai";
import { LanguageModel, streamText } from "ai";
import { AgentAction } from "../../../../../roam/src/components/canvas/agent/shared/types/AgentAction";
import { AgentPrompt } from "../../../../../roam/src/components/canvas/agent/shared/types/AgentPrompt";
import { Streaming } from "../../../../../roam/src/components/canvas/agent/shared/types/Streaming";
import { Environment } from "./environment";
import {
  AgentModelName,
  getAgentModelDefinition,
} from "../../../../../roam/src/components/canvas/agent/models";
import { buildMessagesServer } from "./prompt/buildMessagesServer";
import { buildSystemPromptServer } from "./prompt/buildSystemPromptServer";
import { getModelNameServer } from "./prompt/getModelNameServer";
import { closeAndParseJson } from "./do/closeAndParseJson";

/**
 * Extract text content from user's message for use as default text in shapes
 * Looks for quoted text or text after "with text" phrases
 */
const extractTextFromPrompt = (prompt: AgentPrompt): string | null => {
  // Get the messages from the messages part
  const messagesPart = prompt.messages;
  if (
    !messagesPart ||
    !messagesPart.messages ||
    messagesPart.messages.length === 0
  ) {
    return null;
  }

  const lastMessage =
    messagesPart.messages[messagesPart.messages.length - 1] || "";

  // Try to extract quoted text: "text" or 'text'
  const quotedMatch = lastMessage.match(/["']([^"']+)["']/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Try to extract text after "with text" or "text is" patterns
  const textPatternMatch = lastMessage.match(
    /(?:with text|text is|text:|labelled?|called?)\s+["']?([^"'\n]+)["']?/i,
  );
  if (textPatternMatch && textPatternMatch[1]) {
    return textPatternMatch[1].trim();
  }

  return null;
};

export class AgentService {
  openai: OpenAIProvider;
  anthropic: AnthropicProvider;

  constructor(env: Environment) {
    this.openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    // Anthropic is optional since we default to OpenAI
    this.anthropic = createAnthropic({
      apiKey: env.ANTHROPIC_API_KEY || "",
    });
  }

  getModel(modelName: AgentModelName): LanguageModel {
    const modelDefinition = getAgentModelDefinition(modelName);
    const provider = modelDefinition.provider;

    if (provider === "openai") {
      return this.openai(modelDefinition.id);
    } else if (provider === "anthropic") {
      return this.anthropic(modelDefinition.id);
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  async *stream(prompt: AgentPrompt): AsyncGenerator<Streaming<AgentAction>> {
    try {
      const modelName = getModelNameServer(prompt);
      const model = this.getModel(modelName);
      for await (const event of streamActions(model, prompt)) {
        yield event;
      }
    } catch (error: any) {
      console.error("Stream error:", error);
      throw error;
    }
  }
}

async function* streamActions(
  model: LanguageModel,
  prompt: AgentPrompt,
): AsyncGenerator<Streaming<AgentAction>> {
  if (typeof model === "string") {
    throw new Error("Model is a string, not a LanguageModel");
  }

  const messages = buildMessagesServer(prompt);
  const systemPrompt = buildSystemPromptServer(prompt);

  // Extract potential text content from user's last message for shapes with empty text
  const userTextContent = extractTextFromPrompt(prompt);

  try {
    messages.push({
      role: "assistant",
      content: '{"actions": [{"_type":',
    });
    const result = await streamText({
      model,
      system: systemPrompt,
      messages,
      maxTokens: 8192,
      temperature: 0,
    });

    const textStream = result.textStream;
    if (!textStream) {
      throw new Error("textStream is not available in the response");
    }

    const canForceResponseStart = model.provider === "anthropic.messages";
    let buffer = canForceResponseStart ? '{"actions": [{"_type":' : "";
    let cursor = 0;
    let maybeIncompleteAction: AgentAction | null = null;

    let startTime = Date.now();
    for await (const text of textStream) {
      buffer += text;

      const partialObject = closeAndParseJson(buffer);
      if (!partialObject) continue;

      const actions = partialObject.actions;
      if (!Array.isArray(actions)) continue;
      if (actions.length === 0) continue;

      // Transform actions to match expected format
      const transformedActions = actions
        .map((action: any) => {
          if (
            action._type === "create" &&
            action.shapes &&
            Array.isArray(action.shapes)
          ) {
            // Convert shapes array to single shape object
            const firstShape = action.shapes[0];
            if (firstShape) {
              // Map "node" to "note" since node is not a valid shape type
              // Note shapes support text without textOptions requirements
              const shapeType = firstShape.type || firstShape._type || "note";
              const mappedType = shapeType === "node" ? "note" : shapeType;

              // Transform the shape to match SimpleShape schema
              const transformedShape: any = {
                _type: mappedType,
                shapeId:
                  firstShape.shapeId ||
                  `shape_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                x: firstShape.x ?? 0,
                y: firstShape.y ?? 0,
                color: firstShape.color || "black",
                note: firstShape.note || "",
              };

              // Add shape-specific properties based on type
              if (mappedType === "text") {
                // Text shape requires non-empty text
                transformedShape.text =
                  firstShape.text?.trim() || userTextContent || "Text";
                if (firstShape.fontSize !== undefined) {
                  transformedShape.fontSize = firstShape.fontSize;
                }
                if (firstShape.width !== undefined) {
                  transformedShape.width = firstShape.width;
                }
              } else if (mappedType === "note") {
                // Note shapes support text
                // Use AI-provided text, fallback to extracted text from user message, or empty string
                transformedShape.text =
                  firstShape.text || userTextContent || "";
              } else if (
                mappedType === "rectangle" ||
                mappedType === "ellipse" ||
                mappedType === "triangle" ||
                mappedType === "diamond"
              ) {
                // Geo shapes need w and h
                // Calculate reasonable size based on text length if provided
                const textLength = firstShape.text ? firstShape.text.length : 0;
                const estimatedWidth = Math.max(textLength * 12 + 40, 100);
                transformedShape.w = firstShape.w ?? estimatedWidth;
                transformedShape.h = firstShape.h ?? 50;
                transformedShape.fill = firstShape.fill || "none";
                // Don't include text in geo shapes - causes textOptions error in Roam
                // The text will need to be added separately or use note shapes
              }

              return {
                _type: "create",
                intent: action.intent || "Create shape",
                shape: transformedShape,
              };
            }
          }
          // Filter out label actions since text is already included in create
          if (action._type === "label") {
            return null;
          }
          return action;
        })
        .filter((action: any) => action !== null);

      // Skip if no valid actions after transformation
      if (transformedActions.length === 0) continue;

      // If the events list is ahead of the cursor, we know we've completed the current event
      // We can complete the event and move the cursor forward
      if (transformedActions.length > cursor) {
        const action = transformedActions[cursor - 1] as AgentAction;
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

      // Now let's check the (potentially new) current event
      // And let's yield it in its (potentially incomplete) state
      const action = transformedActions[cursor - 1] as AgentAction;
      if (action) {
        // If we don't have an incomplete event yet, this is the start of a new one
        if (!maybeIncompleteAction) {
          startTime = Date.now();
        }

        maybeIncompleteAction = action;

        // Yield the potentially incomplete event
        yield {
          ...action,
          complete: false,
          time: Date.now() - startTime,
        };
      }
    }

    // If we've finished receiving events, but there's still an incomplete event, we need to complete it
    if (maybeIncompleteAction) {
      yield {
        ...maybeIncompleteAction,
        complete: true,
        time: Date.now() - startTime,
      };
    }
  } catch (error: any) {
    console.error("streamEventsVercel error:", error);
    throw error;
  }
}
