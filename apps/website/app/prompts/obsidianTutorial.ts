import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import type { TutorialRequest } from "~/types/obsidianTutorial";

// Deployed with the route through outputFileTracingIncludes in next.config.ts.
const DOCS_DIR = path.join(process.cwd(), "content", "obsidian");

const INSTRUCTIONS = `You write short interactive tutorials that run inside Obsidian with the Discourse Graph plugin installed. A tutorial is a list of steps the user does in their own vault, one action per step. Each step shows on a small card while the user works, and the plugin moves on when it detects the action.

Step kinds, best first:
- block: one of the listed blocks. The plugin highlights the right part of the screen and moves on at the block's completesWhen. Use a block whenever one fits, and pass every parameter it lists.
- command: a command from the vault's command list, by its exact id. It completes the moment the command runs, which for commands that open a window is when the window opens, not when the user finishes in it.
- ribbon: a ribbon icon, by its exact label. It completes on the click.
- settings-tab: a Settings tab, by its exact id. It completes when the tab opens. Settings opens in a separate window where the card isn't visible, so the body must say where to click before the user opens Settings.
- text: anything else. The user clicks Next, so use these sparingly, for explanations or actions nothing else can detect.

Only use block ids, command ids, ribbon labels, tab ids and node types that appear in the request; anything else is shown as a plain text step.

One action per step, and the body asks only for what happens up to the step's completion point; the card moves on at that moment, so anything after it in the body is lost. Put the follow-up in its own step, as a text step if nothing detects it.

Each step must be doable from where the previous step leaves the user. A step that happens inside a window, panel or note needs an earlier step that opens it.

Mark a step basics: true when it teaches a general Obsidian skill rather than a Discourse Graph one (opening the command palette, creating a plain note) and an experienced user could skip it without a later step failing. A step whose result later steps rely on, such as selected text or a note's content, is never basics. The plugin hides basics steps for users who already know Obsidian.

Aim for 4 to 10 steps that get the user to a first concrete result for their goal using their own material, rather than a tour of every feature. Titles stay under 6 words. Bodies are 1 to 2 sentences in second person and sentence case, and name UI labels exactly as they appear. If the goal has nothing to do with Obsidian or Discourse Graph, return a short tutorial that explains what the plugin is for.

The plugin's documentation follows. Its screenshots are not included, so rely on the text for where things are.`;

const listDocFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listDocFiles(fullPath);
      return /\.mdx?$/.test(entry.name) ? [fullPath] : [];
    }),
  );
  return nested.flat();
};

// MDX import/export lines are build plumbing, not documentation.
const stripMdxModuleLines = (body: string): string =>
  body
    .split("\n")
    .filter((line) => !/^(import|export)\s/.test(line))
    .join("\n")
    .trim();

const renderDocs = async (): Promise<string> => {
  // Sorted so the prompt bytes are identical across requests and the cache hits.
  const files = (await listDocFiles(DOCS_DIR)).sort();
  const docs = await Promise.all(
    files.map(async (file) => {
      const { data, content } = matter(await readFile(file, "utf8"));
      const slug = path
        .relative(DOCS_DIR, file)
        .replace(/\.mdx?$/, "")
        .split(path.sep)
        .join("/");
      const title = typeof data.title === "string" ? data.title : slug;
      return `<doc path="${slug}" title="${title}">\n${stripMdxModuleLines(content)}\n</doc>`;
    }),
  );
  return docs.join("\n\n");
};

let systemPromptPromise: Promise<string> | null = null;

export const getTutorialSystemPrompt = (): Promise<string> => {
  systemPromptPromise ??= renderDocs()
    .then(
      (docs) => `${INSTRUCTIONS}\n\n<documentation>\n${docs}\n</documentation>`,
    )
    .catch((error: unknown) => {
      systemPromptPromise = null;
      throw error;
    });
  return systemPromptPromise;
};

export const buildTutorialUserPrompt = ({
  goal,
  newToObsidian,
  pluginVersion,
  vault,
  blocks,
}: TutorialRequest): string =>
  [
    `Plugin version: ${pluginVersion}`,
    `The user is ${newToObsidian ? "new to Obsidian" : "already comfortable with Obsidian"}.`,
    `<blocks>\n${JSON.stringify(blocks)}\n</blocks>`,
    `<vault>\n${JSON.stringify(vault)}\n</vault>`,
    `<goal>\n${goal}\n</goal>`,
  ].join("\n\n");
