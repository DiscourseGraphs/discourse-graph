import { z } from "zod";
import { AgentActionUtil } from "./AgentActionUtil";
import { createShapeId } from "tldraw";

const CreateTextAction = z.object({
  _type: z.literal("create_text"),
  text: z.string(),
  x: z.number(),
  y: z.number(),
});

type CreateTextAction = z.infer<typeof CreateTextAction>;

export class CreateTextActionUtil extends AgentActionUtil<"create_text"> {
  static override type = "create_text";

  getSchema() {
    return CreateTextAction;
  }

  async applyAction(action: CreateTextAction) {
    this.editor.createShapes([
      {
        id: createShapeId(),
        type: "text",
        x: action.x,
        y: action.y,
        props: {
          text: action.text,
          size: "m",
        },
      },
    ]);
  }
}
