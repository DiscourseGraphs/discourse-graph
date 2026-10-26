import { describe, expect, it } from "vitest";
import type DiscourseGraphPlugin from "~/index";
import {
  resolveTutorialSteps,
  type TutorialStep,
} from "~/components/tutorial/blocks";

const KNOWN_COMMAND = "@discourse-graph/obsidian:create-discourse-node";

const plugin = {
  settings: {
    nodeTypes: [{ id: "node_claim", name: "Claim" }],
    relationTypes: [
      { id: "rel_supports", label: "supports", complement: "is supported by" },
    ],
  },
  app: {
    setting: {
      settingTabs: [{ id: "editor" }],
      pluginTabs: [{ id: "@discourse-graph/obsidian" }],
    },
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

  it("checks settings-tab steps against core and plugin tabs", () => {
    const resolveTab = (tabId: string) =>
      resolveOne({ kind: "settings-tab", tabId, title: "t", body: "b" });
    expect(resolveTab("editor").watchDone).toBeTypeOf("function");
    expect(resolveTab("@discourse-graph/obsidian").watchDone).toBeTypeOf(
      "function",
    );
    expect(resolveTab("made-up-tab").watchDone).toBeUndefined();
  });

  it("lets open-note match any note, or only a node type this vault has", () => {
    const openNote = (params?: Record<string, string>) =>
      resolveOne({
        kind: "block",
        block: "open-note",
        params,
        title: "t",
        body: "b",
      });
    expect(openNote().watchDone).toBeTypeOf("function");
    expect(openNote({ nodeType: "" }).watchDone).toBeTypeOf("function");
    expect(openNote({ nodeType: "Claim" }).watchDone).toBeTypeOf("function");
    expect(openNote({ nodeType: "Hypothesis" }).watchDone).toBeUndefined();
  });

  it("downgrades convert-to-node for a node type this vault lacks", () => {
    const convert = (nodeType: string) =>
      resolveOne({
        kind: "block",
        block: "convert-to-node",
        params: { nodeType },
        title: "t",
        body: "b",
      });
    expect(convert("claim").watchDone).toBeTypeOf("function");
    expect(convert("Hypothesis").watchDone).toBeUndefined();
  });

  it("matches add-relation by label or complement, and downgrades unknown ones", () => {
    const addRelation = (relationType: string) =>
      resolveOne({
        kind: "block",
        block: "add-relation",
        params: { relationType },
        title: "t",
        body: "b",
      });
    expect(addRelation("Supports").watchDone).toBeTypeOf("function");
    expect(addRelation("is supported by").watchDone).toBeTypeOf("function");
    expect(addRelation("contradicts").watchDone).toBeUndefined();
  });

  it("backs the parameterless select-text and create-base blocks", () => {
    for (const block of ["select-text", "create-base"]) {
      expect(
        resolveOne({ kind: "block", block, title: "t", body: "b" }).watchDone,
      ).toBeTypeOf("function");
    }
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
