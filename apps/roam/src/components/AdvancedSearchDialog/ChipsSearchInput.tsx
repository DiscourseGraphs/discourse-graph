import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  type RefObject,
} from "react";
import { type NodeTypeConfig, hexToRgba } from "./types";

type Props = {
  chips: string[];
  setChips: (chips: string[]) => void;
  value: string;
  setValue: (v: string) => void;
  types: NodeTypeConfig[];
  inputRef: RefObject<HTMLInputElement>;
  onArrowDown: () => void;
  onArrowUp: () => void;
  onEnter: () => void;
  onShiftEnter: () => void;
  onCmdEnter: () => void;
  onEscape: () => void;
};

type Ghost = {
  typeId: string;
  full: string; // full alias string
};

const ChipsSearchInput = ({
  chips,
  setChips,
  value,
  setValue,
  types,
  inputRef,
  onArrowDown,
  onArrowUp,
  onEnter,
  onShiftEnter,
  onCmdEnter,
  onEscape,
}: Props) => {
  const [focusedChip, setFocusedChip] = useState(-1);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Build lookup map once per types change — avoids repeated find() in render
  const typesById = useMemo(
    () => Object.fromEntries(types.map((t) => [t.id, t])),
    [types],
  );

  // Focus chip element when focusedChip changes
  useEffect(() => {
    if (focusedChip >= 0 && chipRefs.current[focusedChip]) {
      chipRefs.current[focusedChip]?.focus();
    }
  }, [focusedChip]);

  // Clamp focusedChip when chip list shrinks
  useEffect(() => {
    if (focusedChip >= chips.length) setFocusedChip(-1);
  }, [chips.length, focusedChip]);

  const focusInput = () => {
    setFocusedChip(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Ghost autocomplete: value prefix matches exactly one unselected alias
  const ghost = useMemo((): Ghost | null => {
    const v = value.trim().toLowerCase();
    if (!v) return null;

    const candidates: Ghost[] = [];
    for (const t of types) {
      if (chips.includes(t.id)) continue;
      for (const alias of t.aliases) {
        if (alias.toLowerCase().startsWith(v) && alias.toLowerCase() !== v) {
          candidates.push({ typeId: t.id, full: alias });
          break;
        }
      }
    }
    return candidates.length === 1 ? candidates[0] : null;
  }, [value, types, chips]);

  const tryConsumeAsTrigger = (word: string): boolean => {
    const lower = word.toLowerCase();
    const match = types.find(
      (t) =>
        !chips.includes(t.id) &&
        t.aliases.some((a) => a.toLowerCase() === lower),
    );
    if (match) {
      setChips([...chips, match.id]);
      return true;
    }
    return false;
  };

  const removeChip = (idx: number) => chips.filter((_, i) => i !== idx);

  const onChipKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (idx > 0) setFocusedChip(idx - 1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      if (idx < chips.length - 1) setFocusedChip(idx + 1);
      else focusInput();
      return;
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      const next = removeChip(idx);
      setChips(next);
      if (next.length === 0) {
        focusInput();
        return;
      }
      if (e.key === "Backspace") {
        setFocusedChip(idx > 0 ? idx - 1 : 0);
      } else {
        if (idx >= next.length) focusInput();
        else setFocusedChip(idx);
      }
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const next = removeChip(idx);
      setChips(next);
      if (idx > 0 && next.length > 0)
        setFocusedChip(Math.min(idx, next.length - 1));
      else focusInput();
      return;
    }
    if (e.key === "Escape") {
      focusInput();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onArrowUp();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      onArrowDown();
      return;
    }
    // Printable char → return focus to input and let the keystroke land
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      focusInput();
    }
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab") {
      if (ghost) {
        e.preventDefault();
        setChips([...chips, ghost.typeId]);
        setValue("");
      }
      return;
    }

    if (e.key === " ") {
      // If input is a single token (no embedded spaces), try to convert to chip
      if (!/\s/.test(value) && value.length > 0) {
        if (tryConsumeAsTrigger(value)) {
          e.preventDefault();
          setValue("");
          return;
        }
      }
    }

    if (e.key === "Backspace") {
      const el = inputRef.current;
      if (
        el &&
        el.selectionStart === 0 &&
        el.selectionEnd === 0 &&
        value.length === 0 &&
        chips.length > 0
      ) {
        e.preventDefault();
        setFocusedChip(chips.length - 1);
        return;
      }
    }

    if (e.key === "ArrowLeft") {
      const el = inputRef.current;
      if (
        el &&
        el.selectionStart === 0 &&
        el.selectionEnd === 0 &&
        chips.length > 0
      ) {
        e.preventDefault();
        setFocusedChip(chips.length - 1);
        return;
      }
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      onArrowDown();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onArrowUp();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) onCmdEnter();
      else if (e.shiftKey) onShiftEnter();
      else onEnter();
      return;
    }

    if (e.key === "Escape") {
      onEscape();
    }
  };

  return (
    <div className="dg-as-chips-input">
      {chips.map((id, idx) => {
        const t = typesById[id];
        if (!t) return null;
        const isFocused = focusedChip === idx;
        const chipStyle: React.CSSProperties = {
          background: hexToRgba(t.color, isFocused ? 0.18 : 0.08),
          borderColor: hexToRgba(t.color, isFocused ? 1 : 0.3),
          color: t.color,
          boxShadow: isFocused
            ? `0 0 0 2px ${hexToRgba(t.color, 0.2)}`
            : undefined,
        };
        return (
          <span
            key={id}
            ref={(el) => {
              chipRefs.current[idx] = el;
            }}
            className="dg-as-chip"
            style={chipStyle}
            tabIndex={-1}
            role="button"
            aria-label={`${t.label} filter — press Backspace or Delete to remove`}
            onKeyDown={(e) => onChipKeyDown(e, idx)}
            onClick={() => setFocusedChip(idx)}
          >
            <span className="dg-as-chip-dot" style={{ background: t.color }} />
            <span>{t.label}</span>
            <span
              className="dg-as-chip-x"
              role="button"
              aria-label={`Remove ${t.label} filter`}
              onClick={(e) => {
                e.stopPropagation();
                setChips(chips.filter((x) => x !== id));
                focusInput();
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <line x1="2" y1="2" x2="8" y2="8" />
                <line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </span>
          </span>
        );
      })}

      <span className="dg-as-input-wrap">
        {ghost && (
          <span className="dg-as-ghost" aria-hidden="true">
            <span className="dg-as-ghost-typed">{value}</span>
            <span className="dg-as-ghost-completion">
              {ghost.full.slice(value.length)}
            </span>
            <span className="dg-as-ghost-tabkey">tab</span>
          </span>
        )}
        <input
          ref={inputRef}
          className="dg-as-search-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={chips.length === 0 ? "Search nodes" : ""}
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
      </span>
    </div>
  );
};

export default ChipsSearchInput;
