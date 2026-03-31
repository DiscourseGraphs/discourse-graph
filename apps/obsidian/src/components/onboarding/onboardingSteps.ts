export type OnboardingStep = {
  id: string;
  targetSelector?: string;
  title: string;
  description: string;
  placement: "top" | "bottom" | "left" | "right" | "center";
  advanceOn?: {
    /** DOM event to listen for on the target element (e.g., "click") */
    event?: string;
    /** Element to listen on (defaults to targetSelector) */
    selector?: string;
    /** Advance when this selector appears in the DOM (polling) */
    waitForSelector?: string;
  };
  /** If true, the step can only be advanced via the Next button (no auto-advance). */
  manualAdvance?: boolean;
  onBeforeStep?: () => void;
};

export const TOUR_STEPS: OnboardingStep[] = [
  {
    id: "telescope-icon",
    targetSelector:
      '.side-dock-ribbon-action[aria-label="Toggle discourse context"]',
    title: "Discourse Context Panel",
    description:
      "Click the telescope icon to open the Discourse Context sidebar.",
    placement: "right",
    advanceOn: { event: "click" },
  },
  {
    id: "open-command-palette",
    title: "Open the Command Palette",
    description:
      "Press Cmd+P (Mac) or Ctrl+P (Windows/Linux) to open the command palette.",
    placement: "center",
    advanceOn: { waitForSelector: ".prompt" },
  },
  {
    id: "create-discourse-node",
    targetSelector: ".prompt",
    title: "Create a Discourse Node",
    description:
      'Type "Create discourse node" in the search bar and select it from the list.',
    placement: "bottom",
    manualAdvance: true,
  },
];
