import { App, Scope } from "obsidian";
import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { ObsidianIcon } from "~/components/ObsidianIcon";

/**
 * The trigger-plus-panel shell shared by the search modal's toolbar controls.
 * Every one of them has to solve the same three problems — closing on an
 * outside click, keeping its keystrokes away from the modal's result
 * navigation, and closing on Escape without taking the modal with it — so the
 * answers live here once.
 */

/**
 * Which toolbar panel is open, or null. One value rather than a boolean per
 * control, so two panels can never be open at the same time.
 */
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

  /**
   * Escape cannot be taken from the DOM. Obsidian's Modal registers its
   * close-on-Escape before any plugin React tree exists, so a listener added
   * later runs second at every phase and on every node — even a capture
   * listener on `window` — by which point the modal is already closing.
   * Registering on the modal's own scope does not help either: the built-in
   * handler was registered first and wins. Pushing a scope puts this above the
   * modal in the stack, which is the one place that gets Escape first.
   */
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

  // `activeDocument` rather than `document`, so the listener lands in whichever
  // window holds the modal when Obsidian is running a popout.
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
        // Every keystroke stops here while the panel is open. The modal's handler
        // is an ancestor and reads Enter as "open the highlighted result" and the
        // arrows as "move the selection", so typing in a panel would otherwise
        // open a note and close the whole modal. Escape is deliberately not
        // handled here — it never reaches React, and the modal's keymap scope
        // closes the panel instead.
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
        // Keeps focus in the search input, so arrow and Enter navigation stays
        // live while the panel is open.
        onMouseDown={(event) => event.preventDefault()}
        className={`clickable-icon relative ${isOpen || isActive ? "is-active" : ""}`}
      >
        <ObsidianIcon name={iconName} />
        {badgeCount > 0 && (
          <span
            aria-hidden
            className="bg-accent pointer-events-none absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-lg px-1 text-xs font-semibold leading-none text-white"
          >
            {badgeCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div
          className={`border-modifier-border absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-primary shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
