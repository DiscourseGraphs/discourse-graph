import React, { useId, useLayoutEffect, useRef } from "react";
import { Icon } from "@blueprintjs/core";

/** `bp3-heading` carries the themed text color; `border-0 border-solid` is
 *  required because Roam ships no Tailwind preflight to default border-style. */
const HEADING_CLASS =
  "bp3-heading sticky top-0 z-10 mb-0 text-lg leading-tight pt-1 pb-2 border-0 border-b-2 border-solid border-gray-300";

/** Roam themes restyle `.bp3-dialog` without `.bp3-dark`, so the opaque sticky
 *  background is copied from the dialog rather than hardcoded. */
const StickyHeading = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement => {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const heading = ref.current;
    const dialog = heading?.closest(".bp3-dialog");
    if (!heading || !dialog) return;
    heading.style.backgroundColor = getComputedStyle(dialog).backgroundColor;
  }, []);
  return (
    <div
      ref={ref}
      className={className ? `${HEADING_CLASS} ${className}` : HEADING_CLASS}
      {...props}
    />
  );
};

const getScrollParent = (element: HTMLElement): HTMLElement | null => {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
};

export const SettingsSectionHeading = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement => <StickyHeading>{children}</StickyHeading>;

type Collapsible = { isOpen: boolean; onToggle: () => void };

export const SettingsGroup = ({
  title,
  collapsible,
  children,
}: {
  title: string;
  collapsible?: Collapsible;
  children: React.ReactNode;
}): React.ReactElement => {
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const scrollerToRealign = useRef<HTMLElement | null>(null);
  const isOpen = collapsible?.isOpen ?? true;

  // Collapsing a stuck section removes the content above the viewport; keep its heading in place.
  // Scrolls only the settings scroller: scrollIntoView would also move Blueprint's overlay.
  useLayoutEffect(() => {
    const scroller = scrollerToRealign.current;
    const root = rootRef.current;
    scrollerToRealign.current = null;
    if (!scroller || !root) return;
    scroller.scrollTop +=
      root.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  }, [isOpen]);

  const toggle = (): void => {
    if (!collapsible) return;
    const root = rootRef.current;
    const scroller = root ? getScrollParent(root) : null;
    const isStuck =
      !!root &&
      !!scroller &&
      root.getBoundingClientRect().top < scroller.getBoundingClientRect().top;
    scrollerToRealign.current = isOpen && isStuck ? scroller : null;
    collapsible.onToggle();
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-1">
      {collapsible ? (
        <StickyHeading
          className="flex cursor-pointer items-center gap-1"
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={toggle}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            toggle();
          }}
        >
          <Icon icon={isOpen ? "chevron-down" : "chevron-right"} />
          {title}
        </StickyHeading>
      ) : (
        <StickyHeading>{title}</StickyHeading>
      )}
      {/* Hidden rather than unmounted, so pending setting writes and search anchors survive a collapse. */}
      <div id={contentId} className={isOpen ? "flex flex-col gap-4" : "hidden"}>
        {children}
      </div>
    </div>
  );
};
