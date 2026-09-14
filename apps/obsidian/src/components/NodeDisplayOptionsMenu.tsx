import { App } from "obsidian";
import { useEffect, useRef, type KeyboardEvent, type ReactElement } from "react";
import { SearchDropdown } from "~/components/SearchDropdown";

/**
 * Obsidian's native toggle look: `checkbox-container`'s own onClick, not just the
 * input's onChange — the input alone stops responding after one click. `role="switch"`
 * plus `aria-checked` gives it proper switch semantics, and the input keeps native
 * Tab/Space handling (Enter is added on top, matching this app's other dropdown rows).
 *
 * The input is `pointer-events-none`, so a mouse click always lands on this
 * container (Obsidian's own CSS positions the invisible, `opacity:0` input to
 * cover the whole pill, so without this every mouse click would land on the
 * input instead) — making the container the sole mouse-click handler, while
 * keyboard Space-bar toggling still reaches the input directly (unaffected by
 * `pointer-events`) and is let through via the `event.target === inputRef.current`
 * check below, which this onClick skips for that one case so the two never
 * both fire for the same interaction.
 *
 * The focus ring is plain CSS `:focus-visible` (via Tailwind's `has-[:focus-visible]:`,
 * since the ring must show on this container, not the invisible `opacity:0` input
 * itself) — deliberately not `:focus`/`:focus-within`, which fired for a mouse click
 * too. `:focus-visible` is the browser's own "was this keyboard navigation" heuristic,
 * so a click never shows it. If this ever renders unreliably in this app's cascade the
 * way `:focus-within` once did elsewhere, fall back to the JS-tracked-input-modality
 * approach used for `NodeSortMenu`'s rows instead.
 *
 * `mod-small`, matching the toggle size Obsidian's own built-in search settings
 * popover uses (`.checkbox-container.mod-small` in app.css) — this menu is the
 * same kind of small settings popover, not a full Settings-tab row, so the
 * bigger default toggle read as oversized here.
 */
const ToggleRow = ({
  autoFocus = false,
  checked,
  label,
  onChange,
}: {
  /** Only the panel's first row should claim focus on open — a second `ToggleRow` mounting after it would otherwise steal focus right back. */
  autoFocus?: boolean;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}): ReactElement => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onChange(!checked);
  };

  return (
    <div className="flex items-center justify-between gap-[var(--size-4-3)] px-[var(--size-4-3)] py-[var(--size-2-3)]">
      {/* Not a `<label htmlFor>`: that would let a text click fire the input's own
          onChange *in addition to* the container's onClick below, double-toggling —
          same reason apps/obsidian/src/components/GeneralSettings.tsx's ToggleSetting
          uses a plain div here instead. */}
      <span className="text-normal text-[length:var(--font-ui-small)]">
        {label}
      </span>
      <div
        role="switch"
        aria-checked={checked}
        className={`checkbox-container mod-small has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[-2px] has-[:focus-visible]:outline-[color:var(--background-modifier-border-focus)] ${checked ? "is-enabled" : ""}`}
        // The container itself has no `tabIndex`, so it can never be a focus
        // destination — clicking it still blurs whatever *was* focused (the
        // browser's default mousedown behavior for a non-focusable target),
        // and nothing re-focuses afterward, since there's no native
        // "activation" for a plain div the way there is for a real form
        // control. Left alone, that permanently drops focus to
        // `document.body`, which `SearchDropdown`'s panel reads as "focus
        // left" and closes on — before this onClick even runs. Suppressed by
        // preventing that default mousedown behavior, exactly like
        // `SearchDropdown`'s own trigger button already does to protect the
        // search input's focus.
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          if (event.target === inputRef.current) return;
          onChange(!checked);
        }}
      >
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          aria-label={label}
          onChange={(event) => onChange(event.target.checked)}
          onKeyDown={handleKeyDown}
          className="pointer-events-none"
        />
      </div>
    </div>
  );
};

export const NodeDisplayOptionsMenu = ({
  app,
  isOpen,
  onOpenChange,
  onShowOtherSpacesChange,
  onShowTagsChange,
  showOtherSpaces,
  showTags,
}: {
  app: App;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onShowOtherSpacesChange: (showOtherSpaces: boolean) => void;
  onShowTagsChange: (showTags: boolean) => void;
  showOtherSpaces: boolean;
  showTags: boolean;
}): ReactElement => (
  <SearchDropdown
    app={app}
    ariaLabel="Display options"
    iconName="sliders-horizontal"
    isActive={showTags || showOtherSpaces}
    isOpen={isOpen}
    onOpenChange={onOpenChange}
    panelClassName="w-56"
    title="Display options"
  >
    <ToggleRow
      autoFocus
      checked={showTags}
      label="Show tagged content"
      onChange={onShowTagsChange}
    />
    <ToggleRow
      checked={showOtherSpaces}
      label="Show from other spaces"
      onChange={onShowOtherSpacesChange}
    />
  </SearchDropdown>
);
