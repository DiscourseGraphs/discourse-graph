import React from "react";
import { Icon, type IconName } from "@blueprintjs/core";
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
  onOpenSearchSidebar: () => void;
};

const footerKbdClassName =
  "inline-flex items-center justify-center rounded border border-gray-300 bg-white px-1 py-0.5 text-gray-600";

const footerLabelClassName =
  "inline-flex shrink-0 items-center gap-1 text-xs lowercase text-gray-500";

type FooterShortcutHintProps = {
  disabled?: boolean;
  keyIcons: IconName[];
  label: string;
  onClick?: () => void;
};

const FooterShortcutHint = ({
  disabled = false,
  keyIcons,
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
      {keyIcons.map((icon) => (
        <kbd className={footerKbdClassName} key={icon}>
          <Icon icon={icon} iconSize={12} />
        </kbd>
      ))}
      {label}
    </span>
  </button>
);

const OpenFooterAction = ({
  disabled,
  onOpen,
}: {
  disabled: boolean;
  onOpen: () => void;
}) => (
  <FooterShortcutHint
    disabled={disabled}
    keyIcons={["key-enter"]}
    label="open"
    onClick={() => void onOpen()}
  />
);

const OpenInSidebarFooterAction = ({
  disabled,
  onOpenInSidebar,
}: {
  disabled: boolean;
  onOpenInSidebar: () => void;
}) => (
  <FooterShortcutHint
    disabled={disabled}
    keyIcons={["key-shift", "key-enter"]}
    label="sidebar"
    onClick={() => void onOpenInSidebar()}
  />
);

const InsertFooterAction = ({
  disabled,
  onInsert,
}: {
  disabled: boolean;
  onInsert: () => void;
}) => (
  <FooterShortcutHint
    disabled={disabled}
    keyIcons={["key-command", "key-enter"]}
    label="insert"
    onClick={() => void onInsert()}
  />
);

export const OpenSearchSidebarFooterAction = ({
  disabled,
  onOpenSearchSidebar,
}: {
  disabled: boolean;
  onOpenSearchSidebar: () => void;
}) => (
  <FooterShortcutHint
    disabled={disabled}
    keyIcons={["key-option", "key-enter"]}
    label="open search sidebar"
    onClick={() => void onOpenSearchSidebar()}
  />
);

const CloseFooterHint = () => (
  <span className={footerLabelClassName}>
    <kbd className={footerKbdClassName}>
      <Icon icon="key-escape" iconSize={12} />
    </kbd>
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
  onOpenSearchSidebar,
}: AdvancedSearchFooterProps) => {
  const hasResults = contentState === "results";
  const canOpen = hasActiveResult && hasResults;
  const canInsert = !!insertTarget && hasActiveResult && hasResults;
  const canOpenSearchSidebar = hasResults;

  return (
    <div className="flex w-full flex-none items-center justify-between border-t border-gray-200 bg-gray-50 px-3 py-2">
      <div className="inline-flex shrink-0 items-center gap-3">
        <OpenSearchSidebarFooterAction
          disabled={!canOpenSearchSidebar}
          onOpenSearchSidebar={onOpenSearchSidebar}
        />
        {insertTarget && (
          <InsertFooterAction disabled={!canInsert} onInsert={onInsert} />
        )}
        <OpenFooterAction disabled={!canOpen} onOpen={onOpen} />
        <OpenInSidebarFooterAction
          disabled={!canOpen}
          onOpenInSidebar={onOpenInSidebar}
        />
      </div>
      <CloseFooterHint />
    </div>
  );
};
