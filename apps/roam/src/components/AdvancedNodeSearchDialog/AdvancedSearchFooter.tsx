import React from "react";
import type { InsertTarget } from "~/utils/advancedSearchFooterUtils";

export type AdvancedSearchContentState =
  | "error"
  | "indexing"
  | "initial"
  | "empty"
  | "results";

export type AdvancedSearchFooterProps = {
  contentState: AdvancedSearchContentState;
  hasActiveResult: boolean;
  insertTarget: InsertTarget | null;
  onInsert: () => void;
  onOpen: () => void;
  onOpenInSidebar: () => void;
};

const footerKbdClassName =
  "rounded border border-gray-300 bg-white px-1.5 py-0.5 font-mono text-xs text-gray-600";

const footerLabelClassName =
  "inline-flex shrink-0 items-center gap-1 text-xs lowercase text-gray-500";

type FooterShortcutHintProps = {
  disabled?: boolean;
  keys: string[];
  label: string;
  onClick?: () => void;
};

export const FooterShortcutHint = ({
  disabled = false,
  keys,
  label,
  onClick,
}: FooterShortcutHintProps) => (
  <button
    className="inline-flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    onClick={onClick}
    type="button"
  >
    <span className={footerLabelClassName}>
      {keys.map((key) => (
        <kbd className={footerKbdClassName} key={key}>
          {key}
        </kbd>
      ))}
      {label}
    </span>
  </button>
);

export const OpenFooterAction = ({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: () => void;
}) => (
  <FooterShortcutHint
    disabled={disabled}
    keys={["↵"]}
    label="open"
    onClick={() => void onOpen()}
  />
);

export const OpenInSidebarFooterAction = ({
  disabled,
  onOpenInSidebar,
}: {
  disabled: boolean;
  onOpenInSidebar: () => void;
}) => (
  <FooterShortcutHint
    disabled={disabled}
    keys={["⇧", "↵"]}
    label="sidebar"
    onClick={() => void onOpenInSidebar()}
  />
);

export const InsertFooterAction = ({
  disabled,
  onInsert,
}: {
  disabled: boolean;
  onInsert: () => void;
}) => (
  <FooterShortcutHint
    disabled={disabled}
    keys={["⌘", "↵"]}
    label="insert"
    onClick={() => void onInsert()}
  />
);

const CloseFooterHint = () => (
  <span className={footerLabelClassName}>
    <kbd className={footerKbdClassName}>esc</kbd>
    close
  </span>
);

export const AdvancedSearchFooter = ({
  contentState,
  hasActiveResult,
  insertTarget,
  onInsert,
  onOpen,
  onOpenInSidebar,
}: AdvancedSearchFooterProps) => {
  const hasResults = contentState === "results";
  const canOpen = hasActiveResult && hasResults;
  const canInsert = !!insertTarget && hasActiveResult && hasResults;

  return (
    <div className="flex w-full flex-none items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2">
      <div className="inline-flex shrink-0 items-center gap-3">
        <OpenFooterAction disabled={!canOpen} onOpen={onOpen} />
        <OpenInSidebarFooterAction
          disabled={!canOpen}
          onOpenInSidebar={onOpenInSidebar}
        />
        {insertTarget && (
          <InsertFooterAction disabled={!canInsert} onInsert={onInsert} />
        )}
      </div>
      <CloseFooterHint />
    </div>
  );
};
