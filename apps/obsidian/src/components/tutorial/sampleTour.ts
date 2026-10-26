import { doneOnClick, doneWhenPresent, type TourStep } from "./tourSteps";

const DISCOURSE_CONTEXT_RIBBON =
  '.side-dock-ribbon-action[aria-label="Toggle discourse context"]';
const COMMAND_PALETTE = ".prompt";

/** The hand-written tour from eng-1505, kept to exercise the engine before AI generation exists. */
export const SAMPLE_TOUR: TourStep[] = [
  {
    id: "open-discourse-context",
    target: DISCOURSE_CONTEXT_RIBBON,
    placement: "right",
    title: "Discourse context panel",
    body: "Click the telescope icon to open the discourse context sidebar.",
    watchDone: doneOnClick(DISCOURSE_CONTEXT_RIBBON),
  },
  {
    id: "open-command-palette",
    basics: true,
    title: "Open the command palette",
    body: "Press Cmd+P (Mac) or Ctrl+P (Windows/Linux) to open the command palette.",
    watchDone: doneWhenPresent(COMMAND_PALETTE),
  },
  {
    id: "create-discourse-node",
    target: COMMAND_PALETTE,
    placement: "bottom",
    title: "Create a discourse node",
    body: 'Type "Create discourse node" in the search bar and select it from the list.',
  },
];
