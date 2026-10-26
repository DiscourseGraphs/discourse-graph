import { describe, expect, it } from "vitest";
import type DiscourseGraphPlugin from "~/index";
import {
  resolveTutorialSteps,
  type TutorialStep,
} from "~/components/tutorial/blocks";

const KNOWN_COMMAND = "@discourse-graph/obsidian:create-discourse-node";

const plugin = {
  settings: { nodeTypes: [{ id: "node_claim", name: "Claim" }] },
  app: {
    commands: {
      findCommand: (id: string) =>
        id === KNOWN_COMMAND
          ? { id, name: "Create discourse node" }
          : undefined,
    },
  },
} as unknown as DiscourseGraphPlugin;

const resolveOne = (step: TutorialStep) =>
  resolveTutorialSteps({ plugin, steps: [step] })[0]!;

describe("resolveTutorialSteps", () => {
  it("backs a block with a done-check when the vault has what it needs", () => {
    const step = resolveOne({
      kind: "block",
      block: "create-node",
      params: { nodeType: " claim " },
      title: "t",
      body: "b",
    });
    expect(step.watchDone).toBeTypeOf("function");
  });

  it("downgrades create-node to text when the node type isn't in this vault", () => {
    const step = resolveOne({
      kind: "block",
      block: "create-node",
      params: { nodeType: "Hypothesis" },
      title: "t",
      body: "b",
    });
    expect(step.watchDone).toBeUndefined();
    expect(step.target).toBeUndefined();
  });

  it("downgrades an unknown block to text but keeps its wording", () => {
    const step = resolveOne({
      kind: "block",
      block: "make-coffee",
      title: "Make coffee",
      body: "Brew it",
    });
    expect(step).toEqual({
      id: "step-0",
      title: "Make coffee",
      body: "Brew it",
      basics: undefined,
    });
  });

  it("checks command steps against the live command list", () => {
    const known = resolveOne({
      kind: "command",
      commandId: KNOWN_COMMAND,
      title: "t",
      body: "b",
    });
    const unknown = resolveOne({
      kind: "command",
      commandId: "made-up:command",
      title: "t",
      body: "b",
    });
    expect(known.watchDone).toBeTypeOf("function");
    expect(unknown.watchDone).toBeUndefined();
  });

  it("marks the command palette block as an Obsidian basic", () => {
    const step = resolveOne({
      kind: "block",
      block: "open-command-palette",
      title: "t",
      body: "b",
    });
    expect(step.basics).toBe(true);
  });

  it("gives each step a stable id by position", () => {
    const steps = resolveTutorialSteps({
      plugin,
      steps: [
        { kind: "text", title: "a", body: "a" },
        { kind: "text", title: "b", body: "b" },
      ],
    });
    expect(steps.map((s) => s.id)).toEqual(["step-0", "step-1"]);
  });
});
