import { App, Scope, setIcon } from "obsidian";
import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

/** Which toolbar panel is open, so two can never be open at once. */
export type SearchDropdownId =
  | "type-filter"
  | "sort"
  | "display-options"
  | null;

/** Keyboard-only ring for div items; inset so the panel's overflow-hidden can't clip it. */
export const SEARCH_DROPDOWN_ITEM_FOCUS_RING =
  "outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--background-modifier-border-focus)]";

// tabIndex -1 opts an item out of arrow navigation.
const FOCUSABLE_SELECTOR =
  ':is(input, button, [tabindex]):not([disabled], [tabindex="-1"])';

const getFocusableItems = (panel: HTMLElement): HTMLElement[] =>
  Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isKeyboardOpenRef = useRef(false);

  // Runs after the panel's own effects, so a panel that focuses something itself keeps it.
  useEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel || panel.contains(activeDocument.activeElement)) {
      return;
    }
    // Chromium rings any item focused from a text input, so a pointer open parks focus on the panel instead.
    if (!isKeyboardOpenRef.current) {
      panel.focus();
      return;
    }
    (
      panel.querySelector<HTMLElement>('[aria-checked="true"]') ??
      getFocusableItems(panel)[0]
    )?.focus();
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!isOpen) return;
    // Panel keystrokes must not reach the modal's Enter and arrow result navigation; Escape never arrives here at all.
    event.stopPropagation();
    if (event.nativeEvent.isComposing) return;

    if (event.key === "Tab") {
      // Tab only closes; focus returns to the trigger instead of moving on.
      event.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = panelRef.current ? getFocusableItems(panelRef.current) : [];
    if (!items.length) return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const index = items.indexOf(activeDocument.activeElement as HTMLElement);
    const next =
      index === -1
        ? delta === 1
          ? 0
          : items.length - 1
        : (index + delta + items.length) % items.length;
    items[next]?.focus();
  };

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
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        disabled={isDisabled}
        title={title}
        onClick={(event) => {
          // `detail` is 0 when Enter or Space activated the button.
          isKeyboardOpenRef.current = event.detail === 0;
          onOpenChange(!isOpen);
        }}
        // Keeps the trigger from taking focus; opening moves focus into the panel instead.
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
            className="bg-accent text-on-accent pointer-events-none absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-lg px-1 text-xs font-semibold leading-none"
          >
            {badgeCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div
          ref={panelRef}
          tabIndex={-1}
          data-search-dropdown-panel
          className={`border-modifier-border absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-primary shadow-[shadow:var(--shadow-s)] outline-none ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
