import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTutorialUserPrompt,
  getTutorialSystemPrompt,
} from "~/prompts/obsidianTutorial";
import {
  ModelTutorialSchema,
  TutorialRequestSchema,
  type TutorialRequest,
} from "~/types/obsidianTutorial";

const countDocFiles = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (count, entry) =>
      entry.isDirectory()
        ? count + countDocFiles(path.join(dir, entry.name))
        : count + (/\.mdx?$/.test(entry.name) ? 1 : 0),
    0,
  );

const REQUEST: TutorialRequest = {
  goal: "Track claims from the papers I read",
  newToObsidian: true,
  pluginVersion: "1.5.2",
  vault: {
    nodeTypes: ["Claim", "Evidence"],
    relationTypes: ["supports"],
    commands: [],
    settingTabs: [],
    ribbonLabels: [],
  },
  blocks: [],
};

describe("getTutorialSystemPrompt", () => {
  it("includes every Obsidian doc page without MDX import lines", async () => {
    const prompt = await getTutorialSystemPrompt();
    const docCount = (prompt.match(/<doc path=/g) ?? []).length;
    expect(docCount).toBe(
      countDocFiles(path.join(process.cwd(), "content", "obsidian")),
    );
    expect(prompt).not.toMatch(/^import\s/m);
  });

  it("is byte-identical across calls so the prompt cache can hit", async () => {
    expect(await getTutorialSystemPrompt()).toBe(
      await getTutorialSystemPrompt(),
    );
  });
});

describe("buildTutorialUserPrompt", () => {
  it("puts the goal last and states the user's Obsidian experience", () => {
    const prompt = buildTutorialUserPrompt(REQUEST);
    expect(prompt.trimEnd().endsWith(`${REQUEST.goal}\n</goal>`)).toBe(true);
    expect(prompt).toContain("new to Obsidian");
  });
});

describe("schemas", () => {
  it("rejects a goal too short to act on", () => {
    expect(
      TutorialRequestSchema.safeParse({ ...REQUEST, goal: " a " }).success,
    ).toBe(false);
  });

  it("rejects a block step that is missing its params", () => {
    const result = ModelTutorialSchema.safeParse({
      title: "t",
      steps: [
        {
          kind: "block",
          block: "create-node",
          title: "t",
          body: "b",
          basics: false,
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
