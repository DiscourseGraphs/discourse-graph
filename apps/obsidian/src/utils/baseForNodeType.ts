import { Notice } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseNode } from "~/types";

const generateBaseYaml = (nodeType: DiscourseNode): string => {
  return [
    "views:",
    "  - type: table",
    `    name: "${nodeType.name.replace(/"/g, '\\"')} Nodes"`,

    "    order:",
    "      - file.name",
    "    filters:",
    "      and:",
    `        - nodeTypeId == "${nodeType.id}"`,
    "",
  ].join("\n");
};

const getAvailableFilename = (
  plugin: DiscourseGraphPlugin,
  baseName: string,
): string => {
  if (!plugin.app.vault.getAbstractFileByPath(`${baseName}.base`)) {
    return `${baseName}.base`;
  }
  let i = 1;
  while (plugin.app.vault.getAbstractFileByPath(`${baseName} ${i}.base`)) {
    i++;
  }
  return `${baseName} ${i}.base`;
};

export const createBaseForNodeType = async (
  plugin: DiscourseGraphPlugin,
  nodeType: DiscourseNode,
): Promise<void> => {
  try {
    const filename = getAvailableFilename(plugin, `${nodeType.name} Nodes`);
    const content = generateBaseYaml(nodeType);
    await plugin.app.vault.create(filename, content);
    await plugin.app.workspace.openLinkText(filename, "");
    new Notice(`Created Base view for ${nodeType.name}`);
  } catch (e) {
    new Notice(
      e instanceof Error ? e.message : "Failed to create Base view",
    );
    console.error("Failed to create Base view:", e);
  }
};
