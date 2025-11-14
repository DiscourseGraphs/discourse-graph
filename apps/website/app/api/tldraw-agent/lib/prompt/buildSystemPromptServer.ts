/**
 * Server-safe version of buildSystemPrompt that doesn't instantiate action utilities.
 * This bypasses the PromptPartUtil system to avoid importing React/tldraw on the server.
 */
export function buildSystemPromptServer(prompt: any): string {
  const messages: string[] = [];

  // Extract system prompt directly from the systemPrompt part
  if (prompt.systemPrompt?.systemPrompt) {
    messages.push(prompt.systemPrompt.systemPrompt);
  }

  // Add a basic instruction set for actions
  messages.push(`

You are a helpful AI assistant that can perform actions on a tldraw canvas.

Available actions:
- message: Send a message to the user
- think: Think about the task
- create: Create new shapes
- update: Update existing shapes
- delete: Delete shapes
- move: Move shapes
- label: Add labels to shapes

Respond with JSON in the format: {"actions": [{"_type": "action_type", ...}]}
`);

  return messages.join("");
}
