import type DiscourseGraphPlugin from "~/index";
import { VIEW_TYPE_DISCOURSE_CONTEXT, type DiscourseNode } from "~/types";
import {
  doneOnClick,
  doneWhenBaseCreated,
  doneWhenCommandRuns,
  doneWhenNodeCreated,
  doneWhenNoteConverted,
  doneWhenNoteOpens,
  doneWhenPresent,
  doneWhenSettingsTabOpen,
  doneWhenTextSelected,
  doneWhenViewOpen,
  type TourStep,
} from "./tourSteps";

/** The step format the model produces: what to do, never where the UI is. */
export type TutorialStep = {
  title: string;
  body: string;
  basics?: boolean;
} & (
  | { kind: "block"; block: string; params?: Record<string, string> }
  | { kind: "command"; commandId: string }
  | { kind: "ribbon"; label: string }
  /** Settings opens in its own window, so the card can't spotlight inside it; the body must say where to click. */
  | { kind: "settings-tab"; tabId: string }
  | { kind: "text" }
);

type StepBehavior = Pick<
  TourStep,
  "target" | "placement" | "watchDone" | "basics"
>;

type BlockDefinition = {
  /** Shown to the model so it knows when to pick this block. */
  description: string;
  /** Shown to the model so a step doesn't ask for more than its done-check waits for. */
  completesWhen: string;
  params: readonly string[];
  /** Returns null when the params don't match this vault, so the step falls back to text. */
  resolve: (
    plugin: DiscourseGraphPlugin,
    params: Record<string, string>,
  ) => StepBehavior | null;
};

// CSS.escape is overkill for an attribute value and missing in the Node test environment.
const ribbonSelector = (label: string): string =>
  `.side-dock-ribbon-action[aria-label="${label.replace(/["\\]/g, "\\$&")}"]`;

const findNodeType = (
  plugin: DiscourseGraphPlugin,
  name: string | undefined,
): DiscourseNode | undefined =>
  plugin.settings.nodeTypes.find(
    (candidate) => candidate.name.toLowerCase() === name?.trim().toLowerCase(),
  );

export const BLOCKS: Record<string, BlockDefinition> = {
  "open-command-palette": {
    description: "Open Obsidian's command palette with Cmd/Ctrl+P.",
    completesWhen: "the command palette opens",
    params: [],
    resolve: () => ({ basics: true, watchDone: doneWhenPresent(".prompt") }),
  },
  "create-node": {
    description:
      "Create a discourse node of a given type through the 'Create discourse node' command.",
    completesWhen:
      "a new node of that type is saved (the user has confirmed the Create discourse node window)",
    params: ["nodeType"],
    resolve: (plugin, { nodeType }) => {
      const type = findNodeType(plugin, nodeType);
      if (!type) return null;
      return { watchDone: doneWhenNodeCreated(plugin.app, type.id) };
    },
  },
  "open-discourse-context": {
    description:
      "Open the discourse context panel, which shows a node's relations.",
    completesWhen:
      "the panel is open, immediately if it already is; nothing done inside the panel is detected",
    params: [],
    resolve: (plugin) => ({
      target: ribbonSelector("Toggle discourse context"),
      placement: "right",
      watchDone: doneWhenViewOpen(plugin.app, VIEW_TYPE_DISCOURSE_CONTEXT),
    }),
  },
  "open-note": {
    description:
      "Open a note, for example a node the user just created. Pass nodeType to require a node of that type; leave it empty for any note.",
    completesWhen:
      "a note opens during the step (a node of that type, if given; immediately if one is already the active note)",
    params: ["nodeType"],
    resolve: (plugin, { nodeType }) => {
      if (!nodeType?.trim()) {
        return { watchDone: doneWhenNoteOpens(plugin.app) };
      }
      const type = findNodeType(plugin, nodeType);
      return type
        ? { watchDone: doneWhenNoteOpens(plugin.app, type.id) }
        : null;
    },
  },
  "select-text": {
    description:
      "Select text in the open note, for example a sentence to turn into a node.",
    completesWhen: "any text is selected in the active editor",
    params: [],
    resolve: (plugin) => ({ watchDone: doneWhenTextSelected(plugin.app) }),
  },
  "create-base": {
    description:
      "Make a table of every node of one type: run 'Create Base view for node type' and pick the type.",
    completesWhen: "the Base file is created, after the user picks the type",
    params: [],
    resolve: (plugin) => ({ watchDone: doneWhenBaseCreated(plugin.app) }),
  },
  "convert-to-node": {
    description:
      "Turn an existing note into a discourse node of a given type: with the note open, run 'Convert current page to discourse node', pick the type and confirm.",
    completesWhen: "a note the user had open becomes a node of that type",
    params: ["nodeType"],
    resolve: (plugin, { nodeType }) => {
      const type = findNodeType(plugin, nodeType);
      return type
        ? { watchDone: doneWhenNoteConverted(plugin.app, type.id) }
        : null;
    },
  },
};

const resolveBehavior = (
  plugin: DiscourseGraphPlugin,
  step: TutorialStep,
): StepBehavior | null => {
  switch (step.kind) {
    case "block":
      return BLOCKS[step.block]?.resolve(plugin, step.params ?? {}) ?? null;
    case "command":
      return plugin.app.commands.findCommand(step.commandId)
        ? { watchDone: doneWhenCommandRuns(plugin.app, step.commandId) }
        : null;
    case "ribbon": {
      const target = ribbonSelector(step.label);
      return document.querySelector(target)
        ? { target, placement: "right", watchDone: doneOnClick(target) }
        : null;
    }
    case "settings-tab": {
      const { settingTabs, pluginTabs } = plugin.app.setting;
      return [...settingTabs, ...pluginTabs].some(
        (tab) => tab.id === step.tabId,
      )
        ? { watchDone: doneWhenSettingsTabOpen(plugin.app, step.tabId) }
        : null;
    }
    case "text":
      return {};
  }
};

/** Anything this vault can't back with a real target or check becomes a plain text step. */
export const resolveTutorialSteps = ({
  plugin,
  steps,
}: {
  plugin: DiscourseGraphPlugin;
  steps: TutorialStep[];
}): TourStep[] =>
  steps.map((step, index) => ({
    id: `step-${index}`,
    title: step.title,
    body: step.body,
    basics: step.basics,
    ...(resolveBehavior(plugin, step) ?? {}),
  }));
