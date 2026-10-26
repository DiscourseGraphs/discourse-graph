import { requestUrl } from "obsidian";
import { nextApiRoot } from "@repo/utils/execContext";
import type DiscourseGraphPlugin from "~/index";
import { BLOCKS, type TutorialStep } from "./blocks";

// Matches the caps the endpoint enforces on its request schema.
const MAX_COMMANDS = 1000;

const getRibbonLabels = (): string[] =>
  [...document.querySelectorAll(".side-dock-ribbon-action")]
    .map((element) => element.getAttribute("aria-label"))
    .filter((label): label is string => !!label);

const isTutorialResponse = (
  body: unknown,
): body is { title: string; steps: TutorialStep[] } =>
  typeof body === "object" &&
  body !== null &&
  Array.isArray((body as { steps?: unknown }).steps);

export const requestTutorial = async ({
  plugin,
  goal,
  newToObsidian,
}: {
  plugin: DiscourseGraphPlugin;
  goal: string;
  newToObsidian: boolean;
}): Promise<{ title: string; steps: TutorialStep[] }> => {
  const { app, settings, manifest } = plugin;
  const response = await requestUrl({
    url: `${nextApiRoot()}/obsidian/tutorial`,
    method: "POST",
    contentType: "application/json",
    throw: false,
    body: JSON.stringify({
      goal,
      newToObsidian,
      pluginVersion: manifest.version,
      vault: {
        nodeTypes: settings.nodeTypes.map((type) => type.name),
        relationTypes: settings.relationTypes.map((type) => type.label),
        commands: Object.values(app.commands.commands)
          .slice(0, MAX_COMMANDS)
          .map(({ id, name }) => ({ id, name })),
        settingTabs: [
          ...app.setting.settingTabs,
          ...app.setting.pluginTabs,
        ].map(({ id, name }) => ({ id, name })),
        ribbonLabels: getRibbonLabels(),
      },
      blocks: Object.entries(BLOCKS).map(([id, block]) => ({
        id,
        description: block.description,
        completesWhen: block.completesWhen,
        params: [...block.params],
      })),
    }),
  });

  let body: unknown;
  try {
    body = response.json;
  } catch {
    throw new Error(`Unexpected response (${response.status})`);
  }
  if (response.status !== 200 || !isTutorialResponse(body)) {
    const message = (body as { error?: unknown } | null)?.error;
    throw new Error(
      typeof message === "string"
        ? message
        : `Request failed (${response.status})`,
    );
  }
  return body;
};
