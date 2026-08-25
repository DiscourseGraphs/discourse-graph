import React from "react";
import { Icon } from "@blueprintjs/core";
import { getHintKeys, type HintKey } from "~/utils/keyboardHints";
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
  "roamjs-footer-kbd inline-flex items-center justify-center rounded border border-gray-300 bg-white px-1 py-0.5 text-gray-600";

const footerLabelClassName =
  "inline-flex shrink-0 items-center gap-1 text-xs lowercase text-gray-500";

const HintKeyList = ({ keys }: { keys: HintKey[] }) => (
  <>
    {getHintKeys(keys).map((hint, index) => (
      <kbd className={footerKbdClassName} key={keys[index]}>
        {hint.type === "icon" ? (
          <Icon icon={hint.icon} iconSize={12} />
        ) : (
          hint.label
        )}
      </kbd>
    ))}
  </>
);

type FooterShortcutHintProps = {
  disabled?: boolean;
  keys: HintKey[];
  label: string;
  onClick?: () => void;
};

const FooterShortcutHint = ({
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
      <HintKeyList keys={keys} />
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
    keys={["Enter"]}
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
    keys={["Shift", "Enter"]}
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
    keys={["Mod", "Enter"]}
    label="insert"
    onClick={() => void onInsert()}
  />
);

const OpenSearchSidebarFooterAction = ({
  disabled,
  onOpenSearchSidebar,
}: {
  disabled: boolean;
  onOpenSearchSidebar: () => void;
}) => (
  <FooterShortcutHint
    disabled={disabled}
    keys={["Alt", "Enter"]}
    label="dock results"
    onClick={() => void onOpenSearchSidebar()}
  />
);

const CloseFooterHint = () => (
  <span className={footerLabelClassName}>
    <HintKeyList keys={["Escape"]} />
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
