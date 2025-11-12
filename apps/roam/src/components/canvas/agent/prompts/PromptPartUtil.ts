/* eslint-disable @typescript-eslint/no-explicit-any */
import { TldrawAgent } from "../TldrawAgent";

export type PromptPart<T extends string> = {
  type: T;
  [key: string]: any;
};

export abstract class PromptPartUtil<T extends string> {
  static type: string;

  abstract getPart(agent: TldrawAgent): PromptPart<T> | Promise<PromptPart<T>>;
  abstract buildContent(
    part: PromptPart<T>,
  ): { role: "system" | "user" | "assistant"; content: string }[];
}
