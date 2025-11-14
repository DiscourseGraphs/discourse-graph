import { PromptPart, PromptPartUtil } from "./PromptPartUtil";
import { TldrawAgent } from "../TldrawAgent";

type UserMessagePart = PromptPart<"user_message"> & {
  message: string;
};

export class UserMessagePartUtil extends PromptPartUtil<"user_message"> {
  static override type = "user_message";

  getPart(agent: TldrawAgent): UserMessagePart {
    return {
      type: "user_message",
      message: "",
    };
  }

  buildContent(part: UserMessagePart) {
    return [
      {
        role: "user" as const,
        content: part.message,
      },
    ];
  }
}

