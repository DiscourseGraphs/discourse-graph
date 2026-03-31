import { useState, useEffect, useCallback, useRef } from "react";
import { TOUR_STEPS } from "./onboardingSteps";
import type { OnboardingStep } from "./onboardingSteps";

export type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export const useOnboardingTour = (onComplete: () => void) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [targetNotFound, setTargetNotFound] = useState(false);
  const rafRef = useRef<number | null>(null);

  const currentStep: OnboardingStep | undefined = TOUR_STEPS[currentStepIndex];
  const hasTarget = !!currentStep?.targetSelector;

  const dismiss = useCallback(() => {
    setIsActive(false);
    onComplete();
  }, [onComplete]);

  const next = useCallback(() => {
    if (currentStepIndex + 1 >= TOUR_STEPS.length) {
      dismiss();
    } else {
      setCurrentStepIndex((i) => i + 1);
      setTargetNotFound(false);
      setTargetRect(null);
    }
  }, [currentStepIndex, dismiss]);

  // Track target element position (only for steps with a targetSelector)
  useEffect(() => {
    if (!isActive || !currentStep?.targetSelector) return;

    currentStep.onBeforeStep?.();

    const updateRect = () => {
      const el = document.querySelector(currentStep.targetSelector!);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
        setTargetNotFound(false);
      } else {
        setTargetRect(null);
        setTargetNotFound(true);
      }
      rafRef.current = requestAnimationFrame(updateRect);
    };

    rafRef.current = requestAnimationFrame(updateRect);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isActive, currentStep]);

  // Run onBeforeStep for no-target steps
  useEffect(() => {
    if (!isActive || !currentStep || currentStep.targetSelector) return;
    currentStep.onBeforeStep?.();
  }, [isActive, currentStep]);

  // Listen for advanceOn event-based action
  useEffect(() => {
    if (!isActive || !currentStep?.advanceOn?.event) return;

    const advanceOn = currentStep.advanceOn;
    const targetSelector = advanceOn.selector || currentStep.targetSelector;
    if (!targetSelector) return;

    const el = document.querySelector(targetSelector);
    if (!el) return;

    const handler = () => {
      next();
    };

    el.addEventListener(advanceOn.event!, handler, { once: true });

    return () => {
      el.removeEventListener(advanceOn.event!, handler);
    };
  }, [isActive, currentStep, next]);

  // Listen for advanceOn waitForSelector (poll for element appearance)
  useEffect(() => {
    if (!isActive || !currentStep?.advanceOn?.waitForSelector) return;

    const selector = currentStep.advanceOn.waitForSelector;
    let animFrameId: number;

    const poll = () => {
      if (document.querySelector(selector)) {
        next();
        return;
      }
      animFrameId = requestAnimationFrame(poll);
    };

    animFrameId = requestAnimationFrame(poll);

    return () => {
      cancelAnimationFrame(animFrameId);
    };
  }, [isActive, currentStep, next]);

  return {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps: TOUR_STEPS.length,
    targetRect,
    targetNotFound,
    hasTarget,
    next,
    dismiss,
  };
};
