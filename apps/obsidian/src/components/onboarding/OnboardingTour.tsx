import React, { useEffect, useRef, useCallback } from "react";
import { useOnboardingTour } from "./useOnboardingTour";
import type { TargetRect } from "./useOnboardingTour";
import type { OnboardingStep } from "./onboardingSteps";

const SPOTLIGHT_PADDING = 6;

// eslint-disable-next-line @typescript-eslint/naming-convention
const Spotlight = ({ rect }: { rect: TargetRect }) => {
  return (
    <div
      style={{
        position: "fixed",
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
        borderRadius: 4,
        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
        zIndex: 10002,
        pointerEvents: "none",
      }}
    />
  );
};

const getPopoverPosition = (
  rect: TargetRect,
  placement: OnboardingStep["placement"],
): React.CSSProperties => {
  const gap = 12;
  switch (placement) {
    case "right":
      return {
        top: rect.top,
        left: rect.left + rect.width + SPOTLIGHT_PADDING + gap,
      };
    case "left":
      return {
        top: rect.top,
        right: window.innerWidth - rect.left + SPOTLIGHT_PADDING + gap,
      };
    case "bottom":
      return {
        top: rect.top + rect.height + SPOTLIGHT_PADDING + gap,
        left: rect.left,
      };
    case "top":
      return {
        bottom: window.innerHeight - rect.top + SPOTLIGHT_PADDING + gap,
        left: rect.left,
      };
    case "center":
      return {};
  }
};

const popoverBaseStyle: React.CSSProperties = {
  maxWidth: 280,
  padding: "12px 16px",
  borderRadius: 8,
  backgroundColor: "var(--background-primary)",
  color: "var(--text-normal)",
  border: "1px solid var(--background-modifier-border)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
};

const buttonStyle: React.CSSProperties = {
  padding: "4px 12px",
  borderRadius: 4,
  border: "1px solid var(--background-modifier-border)",
  backgroundColor: "var(--background-secondary)",
  color: "var(--text-normal)",
  cursor: "pointer",
  fontSize: 12,
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const PopoverContent = ({
  step,
  stepIndex,
  totalSteps,
  isLastStep,
  onNext,
  onDismiss,
}: {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  isLastStep: boolean;
  onNext: () => void;
  onDismiss: () => void;
}) => {
  return (
    <>
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 4,
        }}
      >
        {step.title}
      </div>
      <div
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--text-muted)",
          marginBottom: 12,
        }}
      >
        {step.description}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: "var(--text-faint)",
          }}
        >
          {stepIndex + 1} / {totalSteps}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onDismiss} style={buttonStyle}>
            Dismiss
          </button>
          <button
            onClick={onNext}
            style={{
              ...buttonStyle,
              backgroundColor: "var(--interactive-accent)",
              color: "var(--text-on-accent)",
              border: "none",
            }}
          >
            {isLastStep ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention
const TargetedPopover = ({
  step,
  stepIndex,
  totalSteps,
  isLastStep,
  rect,
  onNext,
  onDismiss,
}: {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  isLastStep: boolean;
  rect: TargetRect;
  onNext: () => void;
  onDismiss: () => void;
}) => {
  const position = getPopoverPosition(rect, step.placement);

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 10003,
        ...position,
        ...popoverBaseStyle,
      }}
    >
      <PopoverContent
        step={step}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isLastStep={isLastStep}
        onNext={onNext}
        onDismiss={onDismiss}
      />
    </div>
  );
};

/** Floating card for steps with no target element (e.g., command palette actions). */
// eslint-disable-next-line @typescript-eslint/naming-convention
const FloatingCard = ({
  step,
  stepIndex,
  totalSteps,
  isLastStep,
  onNext,
  onDismiss,
}: {
  step: OnboardingStep;
  stepIndex: number;
  totalSteps: number;
  isLastStep: boolean;
  onNext: () => void;
  onDismiss: () => void;
}) => {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 10003,
        ...popoverBaseStyle,
        maxWidth: 320,
      }}
    >
      <PopoverContent
        step={step}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isLastStep={isLastStep}
        onNext={onNext}
        onDismiss={onDismiss}
      />
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const OnboardingTour = ({
  onComplete,
}: {
  onComplete: () => void;
}) => {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    targetRect,
    targetNotFound,
    hasTarget,
    next,
    dismiss,
  } = useOnboardingTour(onComplete);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Escape key dismisses tour
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dismiss]);

  // Dismiss on click outside spotlight and popover (for targeted steps)
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      if (!targetRect || !hasTarget) return;

      // Check if click is inside the popover
      if (
        popoverRef.current &&
        popoverRef.current.contains(e.target as Node)
      ) {
        return;
      }

      // Check if click is inside the spotlight area (target element)
      const inSpotlight =
        e.clientX >= targetRect.left - SPOTLIGHT_PADDING &&
        e.clientX <=
          targetRect.left + targetRect.width + SPOTLIGHT_PADDING &&
        e.clientY >= targetRect.top - SPOTLIGHT_PADDING &&
        e.clientY <=
          targetRect.top + targetRect.height + SPOTLIGHT_PADDING;

      if (!inSpotlight) {
        dismiss();
      }
    },
    [targetRect, hasTarget, dismiss],
  );

  useEffect(() => {
    if (!isActive || !hasTarget) return;
    // Use capture so we see clicks before they reach other handlers
    document.addEventListener("mousedown", handleOutsideClick, true);
    return () =>
      document.removeEventListener("mousedown", handleOutsideClick, true);
  }, [isActive, hasTarget, handleOutsideClick]);

  if (!isActive || !currentStep) return null;

  const isLastStep = currentStepIndex + 1 >= totalSteps;

  // No-target step: floating instruction card, no overlay
  if (!hasTarget) {
    return (
      <FloatingCard
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={totalSteps}
        isLastStep={isLastStep}
        onNext={next}
        onDismiss={dismiss}
      />
    );
  }

  // Target not found in DOM: show fallback
  if (targetNotFound) {
    return (
      <>
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10001,
            background: "rgba(0, 0, 0, 0.5)",
          }}
          onClick={dismiss}
        />
        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10003,
            maxWidth: 320,
            padding: "16px 20px",
            borderRadius: 8,
            backgroundColor: "var(--background-primary)",
            color: "var(--text-normal)",
            border: "1px solid var(--background-modifier-border)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            textAlign: "center" as const,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
            Element not found
          </div>
          <div
            style={{
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            Please expand the left sidebar to see the telescope icon, then try
            again.
          </div>
          <button
            onClick={dismiss}
            style={{
              padding: "6px 16px",
              borderRadius: 4,
              border: "1px solid var(--background-modifier-border)",
              backgroundColor: "var(--background-secondary)",
              color: "var(--text-normal)",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            Close
          </button>
        </div>
      </>
    );
  }

  if (!targetRect) return null;

  // Targeted step: spotlight (with box-shadow dimming) + popover, no click blocker
  return (
    <div ref={popoverRef}>
      {/* Spotlight - pointer-events: none so clicks pass through to target */}
      <Spotlight rect={targetRect} />
      {/* Popover tooltip */}
      <TargetedPopover
        step={currentStep}
        stepIndex={currentStepIndex}
        totalSteps={totalSteps}
        isLastStep={isLastStep}
        rect={targetRect}
        onNext={next}
        onDismiss={dismiss}
      />
    </div>
  );
};
