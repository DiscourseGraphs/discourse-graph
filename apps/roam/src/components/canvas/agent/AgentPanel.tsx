import "./AgentPanel.css";

import React from "react";

import { TldrawAgent } from "./client/agent/TldrawAgent";
import { ChatPanel } from "./client/components/ChatPanel";

type AgentPanelProps = {
  agent: TldrawAgent | null;
};

export function AgentPanel({ agent }: AgentPanelProps) {
  if (!agent) return null;

  return (
    <div className="dg-agent-panel">
      <ChatPanel agent={agent} />
    </div>
  );
}
