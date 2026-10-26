import type { TutorialStep } from "./blocks";

/** Stands in for a generated tutorial and exercises every block; written in the model's step format. */
export const SAMPLE_TUTORIAL: TutorialStep[] = [
  {
    kind: "block",
    block: "open-command-palette",
    title: "Open the command palette",
    body: "Press Cmd+P (Mac) or Ctrl+P (Windows/Linux). Most Discourse Graph actions start here.",
  },
  {
    kind: "command",
    commandId: "file-explorer:new-file",
    title: "Start a paper note",
    body: 'Run "Create new note" for a paper you are reading.',
  },
  {
    kind: "text",
    title: "Write a finding",
    body: "Name the note after the paper, then type one sentence that states a claim from it.",
  },
  {
    kind: "block",
    block: "convert-to-node",
    params: { nodeType: "Source" },
    title: "Make it a Source",
    body: 'Run "Discourse Graph: Convert current page to discourse node", choose Source and confirm.',
  },
  {
    kind: "block",
    block: "select-text",
    title: "Select the finding",
    body: "Drag over the sentence you wrote to select it.",
  },
  {
    kind: "block",
    block: "create-node",
    params: { nodeType: "Claim" },
    title: "Capture it as a claim",
    body: 'With the sentence selected, run "Create discourse node", pick Claim and confirm.',
  },
  {
    kind: "block",
    block: "open-note",
    params: { nodeType: "Claim" },
    title: "Open your claim",
    body: "Click the new link in your Source note to open the Claim.",
  },
  {
    kind: "block",
    block: "open-discourse-context",
    title: "See the claim's context",
    body: "Click the telescope icon to open the discourse context panel.",
  },
  {
    kind: "block",
    block: "create-base",
    title: "List all your claims",
    body: 'Run "Create Base view for node type" and pick Claim.',
  },
  {
    kind: "settings-tab",
    tabId: "@discourse-graph/obsidian",
    title: "Find your node types",
    body: "Open Settings (Cmd/Ctrl+,) and choose Discourse Graph in the sidebar. Node types like Claim and Evidence are configured there.",
  },
  {
    kind: "text",
    title: "You're set up",
    body: "Next, try linking this claim to the evidence that supports it.",
  },
];
