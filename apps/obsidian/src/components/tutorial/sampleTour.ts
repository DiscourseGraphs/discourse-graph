import type { TutorialStep } from "./blocks";

/** Stands in for a generated tutorial until the endpoint exists; written in the model's step format. */
export const SAMPLE_TUTORIAL: TutorialStep[] = [
  {
    kind: "block",
    block: "open-command-palette",
    title: "Open the command palette",
    body: "Press Cmd+P (Mac) or Ctrl+P (Windows/Linux). Most Discourse Graph actions start here.",
  },
  {
    kind: "block",
    block: "create-node",
    params: { nodeType: "Claim" },
    title: "Capture your first claim",
    body: 'Run "Discourse Graph: Create discourse node", pick Claim, and write one claim from something you read.',
  },
  {
    kind: "block",
    block: "open-discourse-context",
    title: "See the claim's context",
    body: "Click the telescope icon to open the discourse context panel. Relations you add will show up here.",
  },
  {
    kind: "text",
    title: "You're set up",
    body: "Next, try linking this claim to the evidence that supports it.",
  },
];
