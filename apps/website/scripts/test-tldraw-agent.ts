/**
 * Simple test script to test the tldraw-agent stream endpoint
 * Usage: npx tsx scripts/test-tldraw-agent.ts
 */

const API_URL =
  process.env.API_URL || "http://localhost:3000/api/tldraw-agent/stream";

async function testCreateTextNode() {
  // Minimal prompt structure that the server-side code can handle
  const prompt = {
    messages: {
      type: "messages",
      messages: ["Create a new node with text 'HEllo world'"],
    },
    modelName: {
      type: "modelName",
      modelName: "gpt-4o",
    },
    systemPrompt: {
      type: "systemPrompt",
      systemPrompt: "",
    },
    chatHistory: {
      type: "chatHistory",
      items: [],
    },
  };

  console.log("Sending request to:", API_URL);
  console.log("Prompt:", JSON.stringify(prompt, null, 2));

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prompt),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", response.status, errorText);
      return;
    }

    if (!response.body) {
      console.error("No response body");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    console.log("\n--- Streaming response ---\n");

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const match = line.match(/^data: (.+)$/m);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            if ("error" in data) {
              console.error("Error:", data.error);
            } else {
              console.log("Action:", JSON.stringify(data, null, 2));
            }
          } catch (err) {
            console.error("Failed to parse:", match[1]);
          }
        }
      }
    }

    console.log("\n--- Stream complete ---\n");
  } catch (error) {
    console.error("Request failed:", error);
  }
}

testCreateTextNode();
