import { describe, expect, it } from "vitest";
import {
  createTourState,
  getCurrentStep,
  isTourFinished,
  recordOutcome,
} from "~/components/tutorial/tourState";
import type { TourStep } from "~/components/tutorial/tourSteps";

const step = (id: string, basics = false): TourStep => ({
  id,
  title: id,
  body: id,
  basics,
});

const STEPS = [step("ribbon"), step("palette", true), step("create-node")];

describe("createTourState", () => {
  it("keeps basics steps for users new to Obsidian", () => {
    const tour = createTourState({ steps: STEPS, includeBasics: true });
    expect(tour.steps.map((s) => s.id)).toEqual([
      "ribbon",
      "palette",
      "create-node",
    ]);
  });

  it("drops basics steps for users who know Obsidian", () => {
    const tour = createTourState({ steps: STEPS, includeBasics: false });
    expect(tour.steps.map((s) => s.id)).toEqual(["ribbon", "create-node"]);
  });
});

describe("recordOutcome", () => {
  it("moves to the next step and remembers how each step ended", () => {
    let tour = createTourState({ steps: STEPS, includeBasics: true });
    expect(getCurrentStep(tour)?.id).toBe("ribbon");

    tour = recordOutcome(tour, "done");
    tour = recordOutcome(tour, "skipped");

    expect(getCurrentStep(tour)?.id).toBe("create-node");
    expect(tour.outcomes).toEqual(["done", "skipped"]);
    expect(isTourFinished(tour)).toBe(false);
  });

  it("finishes after the last step and ignores later outcomes", () => {
    let tour = createTourState({ steps: STEPS, includeBasics: false });
    tour = recordOutcome(tour, "done");
    tour = recordOutcome(tour, "done");

    expect(isTourFinished(tour)).toBe(true);
    expect(getCurrentStep(tour)).toBeUndefined();
    expect(recordOutcome(tour, "done")).toBe(tour);
  });

  it("finishes immediately when every step was filtered out", () => {
    const tour = createTourState({
      steps: [step("palette", true)],
      includeBasics: false,
    });
    expect(isTourFinished(tour)).toBe(true);
  });
});
