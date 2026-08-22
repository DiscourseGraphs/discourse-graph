import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { editorRules, errorRules } from "@repo/eslint-config/obsidian-scanner";

// The rules that block an Obsidian submission reach developers through two
// separate configs. Nothing else keeps them in step, so assert it.
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sampleFile = path.join(appDir, "src/index.ts");

const resolveRules = async (
  configFile: string,
): Promise<Record<string, unknown>> => {
  const eslint = new ESLint({
    cwd: appDir,
    overrideConfigFile: path.join(appDir, configFile),
  });
  const config = (await eslint.calculateConfigForFile(sampleFile)) as {
    rules?: Record<string, unknown>;
  };
  return config.rules ?? {};
};

const severityOf = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

describe("Obsidian scanner rules", () => {
  it("applies every blocking rule as an error in the scanner config", async () => {
    const rules = await resolveRules("eslint.config.scanner.mjs");
    const notErrors = Object.keys(errorRules).filter(
      (rule) => severityOf(rules[rule]) !== 2,
    );
    expect(notErrors).toEqual([]);
  });

  it("registers every editor rule in the config editors read", async () => {
    const rules = await resolveRules("eslint.config.mjs");
    const missing = Object.keys(editorRules).filter(
      (rule) => rules[rule] === undefined || severityOf(rules[rule]) === 0,
    );
    expect(missing).toEqual([]);
  });

  // editorRules is derived from errorRules, so comparing them proves nothing.
  // The drift worth catching is a rule escalated in the config but absent from errorRules,
  // which would block a submission without ever reaching the editor.
  it("declares every rule the scanner config escalates", async () => {
    const rules = await resolveRules("eslint.config.scanner.mjs");
    const undeclared = Object.entries(rules)
      .filter(
        ([rule, value]) =>
          (rule.startsWith("obsidianmd/") ||
            rule.startsWith("eslint-comments/")) &&
          severityOf(value) === 2 &&
          !(rule in errorRules),
      )
      .map(([rule]) => rule);
    expect(undeclared).toEqual([]);
  });
});
