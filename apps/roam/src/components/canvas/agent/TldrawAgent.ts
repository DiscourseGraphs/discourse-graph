/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-empty-function */
import { Editor } from "tldraw";
import { AgentService } from "./AgentService";
import { SystemPromptPartUtil } from "./prompts/SystemPromptPartUtil";
import { PromptPartUtil } from "./prompts/PromptPartUtil";
import { AgentActionUtil } from "./actions/AgentActionUtil";
import { CreateTextActionUtil } from "./actions/CreateTextActionUtil";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export class TldrawAgent {
  editor: Editor;
  private agentService: AgentService;
  public chatHistory: ChatMessage[] = [];
  private onChatHistoryChange: ((history: ChatMessage[]) => void) | null = null;

  prompts: Record<string, PromptPartUtil<any>> = {};
  actions: Record<string, AgentActionUtil<any>> = {};

  constructor(editor: Editor) {
    this.editor = editor;
    this.agentService = new AgentService();

    this.registerPrompt(new SystemPromptPartUtil());

    this.registerAction(new CreateTextActionUtil(this, this.editor));
  }

  private registerPrompt(util: PromptPartUtil<any>) {
    this.prompts[(util.constructor as typeof PromptPartUtil).type] = util;
  }

  private registerAction(util: AgentActionUtil<any>) {
    this.actions[(util.constructor as typeof AgentActionUtil).type] = util;
  }

  public setOnChatHistoryChange(callback: (history: ChatMessage[]) => void) {
    this.onChatHistoryChange = callback;
  }

  private updateChatHistory(newHistory: ChatMessage[]) {
    this.chatHistory = newHistory;
    if (this.onChatHistoryChange) {
      this.onChatHistoryChange([...this.chatHistory]);
    }
  }

  async prompt(
    input: string | { message: string; [key: string]: unknown },
  ): Promise<void> {
    const messageText = typeof input === "string" ? input : input.message;
    this.updateChatHistory([
      ...this.chatHistory,
      { role: "user", content: messageText },
    ]);

    // 1. Build the prompt
    const systemPromptPart = await this.prompts.system_prompt.getPart(this);
    const systemMessage =
      this.prompts.system_prompt.buildContent(systemPromptPart);

    const messages = [...systemMessage, ...this.chatHistory];

    // 2. Stream the response
    let response = "";
    this.updateChatHistory([
      ...this.chatHistory,
      { role: "assistant", content: "..." },
    ]);

    try {
      for await (const chunk of this.agentService.streamCompletion(messages)) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          response += content;
          const newHistory = [...this.chatHistory];
          newHistory[newHistory.length - 1] = {
            role: "assistant",
            content: response,
          };
          this.updateChatHistory(newHistory);
        }
      }
    } catch (error) {
      console.error("Error streaming completion:", error);
      response = "Sorry, I encountered an error.";
    }

    const finalHistory = [...this.chatHistory];
    finalHistory[finalHistory.length - 1] = {
      role: "assistant",
      content: response,
    };
    this.updateChatHistory(finalHistory);

    // 3. Parse and apply actions
    try {
      const parsed = JSON.parse(response);
      if (parsed.actions && Array.isArray(parsed.actions)) {
        for (const action of parsed.actions) {
          const actionUtil = this.actions[action._type];
          if (actionUtil) {
            const validation = actionUtil.getSchema().safeParse(action);
            if (validation.success) {
              await actionUtil.applyAction(validation.data as any);
            } else {
              console.error("Action validation failed:", validation.error);
            }
          } else {
            console.error(`Unknown action type: ${action._type}`);
          }
        }
      }
    } catch (e) {
      console.error("Error parsing or applying actions:", e);
      // We could optionally add a chat message here to inform the user
    }
  }

  cancel(): void {
    console.log("Agent task cancelled");
    // Placeholder for implementation
  }

  reset(): void {
    console.log("Agent reset");
    this.updateChatHistory([]);
  }

  request(input: { message: string; [key: string]: unknown }): Promise<void> {
    console.log("Agent request:", input);
    // Placeholder for implementation
    return Promise.resolve();
  }
}
