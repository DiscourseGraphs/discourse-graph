import React, { useState, useEffect, useRef } from "react";
import { TldrawAgent, ChatMessage } from "./TldrawAgent";

export const AgentPanel = ({ agent }: { agent: TldrawAgent | null }) => {
  const [input, setInput] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (agent) {
      setChatHistory(agent.chatHistory);
      agent.setOnChatHistoryChange(setChatHistory);
    }
  }, [agent]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input && agent) {
      const currentInput = input;
      setInput("");
      await agent.prompt(currentInput);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        width: "300px",
        height: "calc(100% - 20px)",
        backgroundColor: "white",
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "10px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        zIndex: 1000,
        fontFamily: "sans-serif",
      }}
    >
      <div
        ref={chatContainerRef}
        style={{ flexGrow: 1, overflowY: "auto", marginBottom: "10px" }}
      >
        {chatHistory.map((message, index) => (
          <div
            key={index}
            style={{
              marginBottom: "8px",
              padding: "6px 10px",
              borderRadius: "12px",
              backgroundColor: message.role === "user" ? "#e0e0e0" : "#f1f1f1",
              alignSelf: message.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "80%",
              wordBreak: "break-word",
              marginLeft: message.role === "user" ? "auto" : "0",
              marginRight: message.role === "assistant" ? "auto" : "0",
            }}
          >
            <b>{message.role === "user" ? "You" : "Agent"}:</b>{" "}
            <span style={{ whiteSpace: "pre-wrap" }}>{message.content}</span>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <input
          type="text"
          placeholder="Talk to the agent..."
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxSizing: "border-box",
          }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={!agent}
        />
      </form>
    </div>
  );
};
