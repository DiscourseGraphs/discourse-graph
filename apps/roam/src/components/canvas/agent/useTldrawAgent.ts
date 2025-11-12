import { Editor } from "tldraw";
import { TldrawAgent } from "./TldrawAgent";
import { useMemo } from "react";

export const useTldrawAgent = (editor: Editor) => {
  const agent = useMemo(() => new TldrawAgent(editor), [editor]);
  return agent;
};
