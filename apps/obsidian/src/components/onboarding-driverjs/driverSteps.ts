import type { DriveStep } from "driver.js";

/**
 * Phase 1: Highlight the telescope ribbon icon.
 * User clicks the icon or the Next button to advance.
 */
export const telescopeStep: DriveStep = {
  element: '.side-dock-ribbon-action[aria-label="Toggle discourse context"]',
  popover: {
    title: "Discourse Context Panel",
    description:
      "Click the telescope icon to open the Discourse Context sidebar.",
    side: "right",
    align: "start",
  },
};

/**
 * Phase 2: No target element — displayed as a vanilla floating card.
 * driver.js cannot highlight "nothing", so we skip it entirely for this phase.
 */
export const commandPalettePromptStep = {
  title: "Open the Command Palette",
  description:
    "Press Cmd+P (Mac) or Ctrl+P (Windows/Linux) to open the command palette.",
} as const;

/**
 * Phase 3: Highlight the command palette input (.prompt).
 * Shown after the palette opens. Finish button ends the tour.
 */
export const commandPaletteHighlightStep: DriveStep = {
  element: ".prompt",
  popover: {
    title: "Create a Discourse Node",
    description:
      'Type "Create discourse node" in the search bar and select it from the list.',
    side: "bottom",
    align: "start",
  },
};
