/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { TldrawAgent } from "../TldrawAgent";
import { Editor } from "tldraw";

export type AgentAction<T extends string> = {
  _type: T;
  [key: string]: any;
};

export abstract class AgentActionUtil<T extends string> {
  static type: string;

  constructor(
    protected agent: TldrawAgent,
    protected editor: Editor,
  ) {}

  abstract getSchema(): z.ZodObject<any>;
  abstract applyAction(action: AgentAction<T>): void | Promise<void>;
}
