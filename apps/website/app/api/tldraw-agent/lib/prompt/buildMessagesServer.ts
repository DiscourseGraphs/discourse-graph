import { ModelMessage, UserContent } from "ai";

/**
 * Server-safe version of buildMessages that doesn't instantiate prompt part utilities.
 * This extracts messages directly from the prompt parts to avoid importing React/tldraw.
 */
export function buildMessagesServer(prompt: any): ModelMessage[] {
  const messages: ModelMessage[] = [];

  // Extract messages from the messages part
  if (Array.isArray(prompt.messages?.messages)) {
    for (const text of prompt.messages.messages) {
      if (typeof text !== "string" || text.trim() === "") continue;
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text,
          },
        ],
      });
    }
  }

  // Extract chat history if present
  if (prompt.chatHistory?.items) {
    for (const item of prompt.chatHistory.items) {
      // Skip items without proper structure
      if (!item || typeof item !== "object") continue;

      switch (item.type) {
        case "prompt": {
          const content: UserContent = [];

          if (item.message && item.message.trim() !== "") {
            content.push({
              type: "text",
              text: item.message,
            });
          }

          if (item.contextItems && item.contextItems.length > 0) {
            for (const contextItem of item.contextItems) {
              content.push({
                type: "text",
                text: `[CONTEXT]: ${JSON.stringify(contextItem)}`,
              });
            }
          }

          if (content.length > 0) {
            messages.push({
              role: "user",
              content,
            });
          }
          break;
        }
        case "continuation": {
          if (item.data && item.data.length > 0) {
            messages.push({
              role: "assistant",
              content: [
                {
                  type: "text",
                  text: `[DATA RETRIEVED]: ${JSON.stringify(item.data)}`,
                },
              ],
            });
          }
          break;
        }
        case "action": {
          if (item.action) {
            let text: string;
            switch (item.action._type) {
              case "message":
                text = item.action.text || "<message data lost>";
                break;
              case "think":
                text =
                  "[THOUGHT]: " + (item.action.text || "<thought data lost>");
                break;
              default:
                const { complete, time, ...rawAction } = item.action;
                text = "[ACTION]: " + JSON.stringify(rawAction);
                break;
            }
            messages.push({
              role: "assistant",
              content: [{ type: "text", text }],
            });
          }
          break;
        }
      }
    }
  }

  return messages;
}
