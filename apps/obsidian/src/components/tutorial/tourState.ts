import type { TourStep } from "./tourSteps";

export type StepOutcome = "done" | "skipped";

export type TourState = {
  steps: TourStep[];
  outcomes: StepOutcome[];
};

export const createTourState = ({
  steps,
  includeBasics,
}: {
  steps: TourStep[];
  includeBasics: boolean;
}): TourState => ({
  steps: includeBasics ? steps : steps.filter((step) => !step.basics),
  outcomes: [],
});

export const getCurrentStep = (state: TourState): TourStep | undefined =>
  state.steps[state.outcomes.length];

export const isTourFinished = (state: TourState): boolean =>
  state.outcomes.length >= state.steps.length;

export const recordOutcome = (
  state: TourState,
  outcome: StepOutcome,
): TourState =>
  isTourFinished(state)
    ? state
    : { ...state, outcomes: [...state.outcomes, outcome] };
