export type CollapsedSections = ReadonlySet<string>;

export const NODE_CONFIG_SECTIONS = {
  identity: "Identity",
  creation: "Creation",
  canvas: "Canvas",
  legacy: "Legacy",
  suggestiveMode: "Suggestive mode",
  attributes: "Attributes",
} as const;

export const getNodeConfigSections = ({
  isSyncEnabled,
}: {
  isSyncEnabled: boolean;
}): string[] => [
  NODE_CONFIG_SECTIONS.identity,
  NODE_CONFIG_SECTIONS.creation,
  NODE_CONFIG_SECTIONS.canvas,
  NODE_CONFIG_SECTIONS.legacy,
  ...(isSyncEnabled ? [NODE_CONFIG_SECTIONS.suggestiveMode] : []),
  NODE_CONFIG_SECTIONS.attributes,
];

export const toggleSection = (
  collapsed: CollapsedSections,
  section: string,
): CollapsedSections => {
  const next = new Set(collapsed);
  if (next.has(section)) next.delete(section);
  else next.add(section);
  return next;
};

export const areAllSectionsCollapsed = (
  collapsed: CollapsedSections,
  sections: readonly string[],
): boolean => sections.every((section) => collapsed.has(section));

export const toggleAllSections = (
  collapsed: CollapsedSections,
  sections: readonly string[],
): CollapsedSections =>
  areAllSectionsCollapsed(collapsed, sections) ? new Set() : new Set(sections);
