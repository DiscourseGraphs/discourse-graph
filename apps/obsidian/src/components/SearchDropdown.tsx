import { App, Scope, setIcon } from "obsidian";
import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

/** Which toolbar panel is open, so two can never be open at once. */
export type SearchDropdownId = "display-options" | "type-filter" | "sort" | null;

export const SearchDropdown = ({
  app,
  ariaLabel,
  badgeCount = 0,
  children,
  iconName,
  isActive,
  isDisabled = false,
  isOpen,
  onOpenChange,
  panelClassName = "w-64",
  title,
}: {
  app: App;
  ariaLabel: string;
  badgeCount?: number;
  children: ReactNode;
  iconName: string;
  isActive: boolean;
  isDisabled?: boolean;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  panelClassName?: string;
  title: string;
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Obsidian's modal Escape is registered before React exists, and wins on its own scope too, so only a pushed scope gets it first.
  useEffect(() => {
    if (!isOpen) return;
    const scope = new Scope();
    scope.register([], "Escape", () => {
      onOpenChange(false);
      return false;
    });
    app.keymap.pushScope(scope);
    return () => app.keymap.popScope(scope);
  }, [app, isOpen, onOpenChange]);

  // `activeDocument`, so the listener lands in the popout window holding the modal.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    };
    activeDocument.addEventListener("mousedown", handlePointerDown, true);
    return () =>
      activeDocument.removeEventListener("mousedown", handlePointerDown, true);
  }, [isOpen, onOpenChange]);

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (!isOpen) return;
        // Panel keystrokes must not reach the modal's Enter and arrow result navigation; Escape never arrives here at all.
        event.stopPropagation();
      }}
      onBlur={() => {
        if (!isOpen) return;
        // Deferred a tick: a click inside the panel (e.g. the display-options
        // toggle) can blur-then-refocus within the same container, and checking
        // `activeElement` synchronously here would catch it mid-transition and
        // close the panel out from under the very click that was using it.
        //
        // The real fix for that (clicking a non-focusable row element — a
        // label's text, a toggle's covered pill — blurs whatever was
        // focused, and since nothing re-focuses afterward, `document.body`
        // is the *permanent* rest state, not a transient one) lives on each
        // interactive row itself: `onMouseDown` there prevents the browser's
        // default blur in the first place, so focus never leaves the panel
        // for that click at all (see `checkboxLabelClick.ts`). This
        // double-deferred check is a fallback for anything that doesn't do
        // that (or a genuinely slow focus-settle) — a second tick to let it
        // resolve — not the primary defense. A real Tab-away never passes
        // through `body` at all, so it still closes immediately on the first
        // check.
        window.setTimeout(() => {
          if (containerRef.current?.contains(activeDocument.activeElement)) {
            return;
          }
          if (activeDocument.activeElement !== activeDocument.body) {
            onOpenChange(false);
            return;
          }
          window.setTimeout(() => {
            if (containerRef.current?.contains(activeDocument.activeElement)) {
              return;
            }
            onOpenChange(false);
          }, 0);
        }, 0);
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={isDisabled}
        title={title}
        onClick={() => onOpenChange(!isOpen)}
        // Keeps focus in the search input, so arrow and Enter navigation stays live.
        onMouseDown={(event) => event.preventDefault()}
        className={`clickable-icon relative ${isOpen || isActive ? "is-active" : ""}`}
      >
        <span
          className="flex items-center"
          ref={(el) => (el && setIcon(el, iconName)) || undefined}
        />
        {badgeCount > 0 && (
          <span
            aria-hidden
            className="bg-accent text-on-accent pointer-events-none absolute -right-[var(--size-4-1)] -top-[var(--size-4-1)] flex h-3.5 min-w-3.5 items-center justify-center rounded-[var(--radius-m)] px-[var(--size-4-1)] text-[length:var(--font-ui-smaller)] font-semibold leading-none"
          >
            {badgeCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div
          className={`border-modifier-border absolute right-0 top-full z-50 mt-[var(--size-4-1)] overflow-hidden rounded-[var(--radius-m)] border bg-primary shadow-[shadow:var(--shadow-s)] ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
