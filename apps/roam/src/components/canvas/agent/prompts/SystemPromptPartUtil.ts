import { PromptPart, PromptPartUtil } from "./PromptPartUtil";
import { TldrawAgent } from "../TldrawAgent";
import { AgentActionUtil } from "../actions/AgentActionUtil";

const SYSTEM_PROMPT = `You are an expert AI assistant integrated into tldraw, a collaborative digital whiteboard.
Your goal is to help users create and modify diagrams, drawings, and other visual content on the canvas.
You can create shapes, connect them with arrows, add text, and more.
When the user asks you to do something, you must respond with a JSON object containing a list of actions to perform.
The response should be a single JSON object with a key "actions", which is an array of action objects.
For example: { "actions": [{ "_type": "create_text", "text": "Hello World", "x": 100, "y": 100 }] }

Here are the actions you can perform:
`;

type SystemPromptPart = PromptPart<"system_prompt"> & {
  prompt: string;
};

export class SystemPromptPartUtil extends PromptPartUtil<"system_prompt"> {
  static override type = "system_prompt";

  getPart(agent: TldrawAgent): SystemPromptPart {
    let prompt = SYSTEM_PROMPT;

    const actionSchemas = Object.values(agent.actions).map((actionUtil) => {
      const schema = actionUtil.getSchema();
      return `- Action: "${
        (actionUtil.constructor as typeof AgentActionUtil).type
      }"\n  Schema: ${JSON.stringify(schema.shape, null, 2)}`;
    });

    prompt += actionSchemas.join("\n\n");

    return {
      type: "system_prompt",
      prompt,
    };
  }

  buildContent(part: SystemPromptPart) {
    return [
      {
        role: "system" as const,
        content: part.prompt,
      },
    ];
  }
}
