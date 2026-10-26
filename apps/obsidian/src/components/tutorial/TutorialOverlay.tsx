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
import type { TFile } from "obsidian";
import { usePlugin } from "~/components/PluginContext";
import type { TourStep } from "./tourSteps";
import { useCreatedNotes } from "./useCreatedNotes";
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

const SummaryCard = ({
  notes,
  finished,
  onClose,
}: {
  notes: TFile[];
  finished: boolean;
  onClose: () => void;
}) => {
  const plugin = usePlugin();
  const [confirmingTrash, setConfirmingTrash] = useState(false);

  const openNote = (note: TFile): void =>
    void plugin.app.workspace.getLeaf(false).openFile(note);

  const trashNotes = async (): Promise<void> => {
    // trashFile follows the user's "Deleted files" setting, so nothing is removed permanently.
    await Promise.all(
      notes.map((note) => plugin.app.fileManager.trashFile(note)),
    );
    onClose();
  };

  return (
    <div className="dg-tutorial-card dg-tutorial-card--floating">
      <div className="mb-1 font-semibold">
        {finished ? "Tutorial complete" : "Tutorial ended"}
      </div>
      <div className="text-muted mb-2 text-sm">
        {notes.length === 1
          ? "You created this note along the way. Keep it to build on, or move it to the trash."
          : "You created these notes along the way. Keep them to build on, or move them to the trash."}
      </div>
      <ul className="mb-3 mt-0 pl-4 text-sm">
        {notes.map((note) => (
          <li key={note.path}>
            <a onClick={() => openNote(note)}>{note.basename}</a>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        {confirmingTrash ? (
          <>
            <button onClick={() => setConfirmingTrash(false)}>Cancel</button>
            <button className="mod-warning" onClick={() => void trashNotes()}>
              Move {notes.length} to trash
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setConfirmingTrash(true)}>
              Move to trash
            </button>
            <button className="mod-cta" onClick={onClose}>
              {notes.length === 1 ? "Keep it" : "Keep them"}
            </button>
          </>
        )}
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
  const plugin = usePlugin();
  const getCreatedNotes = useCreatedNotes(plugin.app);
  const [endedEarly, setEndedEarly] = useState(false);
  const [summaryNotes, setSummaryNotes] = useState<TFile[] | null>(null);
  const finished = isTourFinished(tour);
  const step = summaryNotes || endedEarly ? undefined : getCurrentStep(tour);
  const { rect, missing } = useTargetRect(step?.target);

  const advance = useCallback((outcome: StepOutcome) => {
    setTour((current) => recordOutcome(current, outcome));
  }, []);

  useEffect(() => {
    if (!finished && !endedEarly) return;
    const notes = getCreatedNotes();
    if (notes.length === 0) onClose();
    else setSummaryNotes(notes);
  }, [finished, endedEarly, getCreatedNotes, onClose]);

  useEffect(() => {
    if (!step?.watchDone) return;
    let isDone = false;
    return step.watchDone(() => {
      if (isDone) return;
      isDone = true;
      advance("done");
    });
  }, [step, advance]);

  if (summaryNotes) {
    return (
      <SummaryCard notes={summaryNotes} finished={finished} onClose={onClose} />
    );
  }
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
        onEnd={() => setEndedEarly(true)}
      />
    </>
  );
};
