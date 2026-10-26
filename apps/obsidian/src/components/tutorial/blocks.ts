import type DiscourseGraphPlugin from "~/index";
import { VIEW_TYPE_DISCOURSE_CONTEXT } from "~/types";
import {
  doneOnClick,
  doneWhenCommandRuns,
  doneWhenNodeCreated,
  doneWhenPresent,
  doneWhenSettingsTabOpen,
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

export const BLOCKS: Record<string, BlockDefinition> = {
  "open-command-palette": {
    description: "Open Obsidian's command palette with Cmd/Ctrl+P.",
    params: [],
    resolve: () => ({ basics: true, watchDone: doneWhenPresent(".prompt") }),
  },
  "create-node": {
    description:
      "Create a discourse node of a given type through the 'Create discourse node' command.",
    params: ["nodeType"],
    resolve: (plugin, { nodeType }) => {
      const type = plugin.settings.nodeTypes.find(
        (candidate) =>
          candidate.name.toLowerCase() === nodeType?.trim().toLowerCase(),
      );
      if (!type) return null;
      return { watchDone: doneWhenNodeCreated(plugin.app, type.id) };
    },
  },
  "open-discourse-context": {
    description:
      "Open the discourse context panel, which shows a node's relations.",
    params: [],
    resolve: (plugin) => ({
      target: ribbonSelector("Toggle discourse context"),
      placement: "right",
      watchDone: doneWhenViewOpen(plugin.app, VIEW_TYPE_DISCOURSE_CONTEXT),
    }),
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
