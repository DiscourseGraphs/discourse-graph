import React, { useId, useLayoutEffect, useRef } from "react";
import { Icon } from "@blueprintjs/core";

/** `bp3-heading` carries the themed text color; `border-0 border-solid` is
 *  required because Roam ships no Tailwind preflight to default border-style. */
const HEADING_CLASS =
  "dg-settings-heading bp3-heading sticky top-0 z-10 mb-0 text-lg leading-tight pt-1 pb-2 border-0 border-b-2 border-solid border-gray-300";

export const SettingsSectionHeading = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement => <div className={HEADING_CLASS}>{children}</div>;

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
  const headingRef = useRef<HTMLDivElement | null>(null);
  const realignAfterCollapse = useRef(false);
  const isOpen = collapsible?.isOpen ?? true;

  // Collapsing a stuck section removes the content above the viewport; keep its heading in place.
  useLayoutEffect(() => {
    if (!realignAfterCollapse.current) return;
    realignAfterCollapse.current = false;
    rootRef.current?.scrollIntoView({ block: "start" });
  }, [isOpen]);

  const toggle = (): void => {
    if (!collapsible) return;
    const rootTop = rootRef.current?.getBoundingClientRect().top ?? 0;
    const headingTop = headingRef.current?.getBoundingClientRect().top ?? 0;
    realignAfterCollapse.current = isOpen && headingTop > rootTop;
    collapsible.onToggle();
  };

  return (
    <div ref={rootRef} className="flex flex-col gap-1">
      {collapsible ? (
        <div
          ref={headingRef}
          className={`${HEADING_CLASS} flex cursor-pointer items-center gap-1`}
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
        </div>
      ) : (
        <div className={HEADING_CLASS}>{title}</div>
      )}
      {/* Hidden rather than unmounted, so pending setting writes and search anchors survive a collapse. */}
      <div id={contentId} className={isOpen ? "flex flex-col gap-4" : "hidden"}>
        {children}
      </div>
    </div>
  );
};
