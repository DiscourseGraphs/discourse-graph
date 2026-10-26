import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { getCardPosition, SPOTLIGHT_PADDING, type Rect } from "./cardPosition";
import {
  createTourState,
  getCurrentStep,
  isTourFinished,
  recordOutcome,
  type StepOutcome,
} from "./tourState";
import type { TourStep } from "./tourSteps";
import { useTargetRect } from "./useTargetRect";

const DEFAULT_CARD_SIZE = { width: 300, height: 150 };

const Spotlight = ({ rect }: { rect: Rect }) => (
  <div
    className="dg-tutorial-spotlight"
    style={{
      top: rect.top - SPOTLIGHT_PADDING,
      left: rect.left - SPOTLIGHT_PADDING,
      width: rect.width + SPOTLIGHT_PADDING * 2,
      height: rect.height + SPOTLIGHT_PADDING * 2,
    }}
  />
);

const StepCard = ({
  step,
  stepNumber,
  totalSteps,
  targetRect,
  targetMissing,
  onAdvance,
  onEnd,
}: {
  step: TourStep;
  stepNumber: number;
  totalSteps: number;
  targetRect: Rect | null;
  targetMissing: boolean;
  onAdvance: (outcome: StepOutcome) => void;
  onEnd: () => void;
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardSize, setCardSize] = useState(DEFAULT_CARD_SIZE);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const { offsetWidth: width, offsetHeight: height } = card;
    if (width !== cardSize.width || height !== cardSize.height) {
      setCardSize({ width, height });
    }
  }, [step, targetMissing, cardSize.width, cardSize.height]);

  const position = targetRect
    ? getCardPosition({
        target: targetRect,
        placement: step.placement ?? "bottom",
        card: cardSize,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      })
    : undefined;
  const isLastStep = stepNumber === totalSteps;
  const needsManualAdvance = !step.watchDone && !targetMissing;

  return (
    <div
      ref={cardRef}
      className={`dg-tutorial-card ${position ? "" : "dg-tutorial-card--floating"}`}
      style={position}
    >
      <div className="mb-1 font-semibold">{step.title}</div>
      <div className="text-muted mb-3 text-sm">{step.body}</div>
      {targetMissing && (
        <div className="text-warning mb-3 text-sm">
          This isn&apos;t on screen right now. Do the step another way, then
          mark it done.
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted text-xs">
          {stepNumber} / {totalSteps}
        </span>
        <div className="flex gap-2">
          <button onClick={onEnd}>End tour</button>
          {!needsManualAdvance && (
            <button onClick={() => onAdvance("skipped")}>
              {step.basics ? "Skip, I know this" : "Skip"}
            </button>
          )}
          {targetMissing && (
            <button className="mod-cta" onClick={() => onAdvance("done")}>
              Mark done
            </button>
          )}
          {needsManualAdvance && (
            <button className="mod-cta" onClick={() => onAdvance("done")}>
              {isLastStep ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const TutorialOverlay = ({
  steps,
  includeBasics,
  onClose,
}: {
  steps: TourStep[];
  includeBasics: boolean;
  onClose: () => void;
}) => {
  const [tour, setTour] = useState(() =>
    createTourState({ steps, includeBasics }),
  );
  const step = getCurrentStep(tour);
  const { rect, missing } = useTargetRect(step?.target);

  const advance = useCallback((outcome: StepOutcome) => {
    setTour((current) => recordOutcome(current, outcome));
  }, []);

  useEffect(() => {
    if (isTourFinished(tour)) onClose();
  }, [tour, onClose]);

  useEffect(() => {
    if (!step?.watchDone) return;
    let isDone = false;
    return step.watchDone(() => {
      if (isDone) return;
      isDone = true;
      advance("done");
    });
  }, [step, advance]);

  if (!step) return null;
  // Wait out the grace period rather than flashing a card in the wrong place.
  if (step.target && !rect && !missing) return null;

  return (
    <>
      {rect && <Spotlight rect={rect} />}
      <StepCard
        step={step}
        stepNumber={tour.outcomes.length + 1}
        totalSteps={tour.steps.length}
        targetRect={rect}
        targetMissing={missing}
        onAdvance={advance}
        onEnd={onClose}
      />
    </>
  );
};
