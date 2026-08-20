import { App, Scope } from "obsidian";
import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { ObsidianIcon } from "~/components/ObsidianIcon";

/** Trigger-plus-panel shell shared by the search modal's toolbar controls. */

/** Which toolbar panel is open, so two can never be open at once. */
export type SearchDropdownId = "type-filter" | "sort" | null;

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
  /** Rendered as a superscript count on the trigger when above zero. */
  badgeCount?: number;
  children: ReactNode;
  iconName: string;
  /** Highlights the trigger to show the control is doing something. */
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
        <ObsidianIcon name={iconName} />
        {badgeCount > 0 && (
          <span
            aria-hidden
            className="bg-accent text-on-accent pointer-events-none absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-lg px-1 text-xs font-semibold leading-none"
          >
            {badgeCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div
          className={`border-modifier-border absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-primary shadow-[shadow:var(--shadow-s)] ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
