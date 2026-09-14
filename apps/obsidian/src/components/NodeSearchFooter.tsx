import { type ReactElement } from "react";
import { getHintKeys, type HintKey } from "~/utils/keyboardHints";

type NodeSearchFooterProps = {
  canAct: boolean;
  canInsertLink: boolean;
  isPreviewOpen: boolean;
  onClose: () => void;
  onInsertLink: () => void;
  onOpenInNewTab: () => void;
  onOpenInSplit: () => void;
  onTogglePreview: () => void;
};

type FooterActionProps = {
  disabled?: boolean;
  keys: HintKey[];
  label: string;
  onClick: () => void;
};

const KeyHints = ({ keys }: { keys: HintKey[] }): ReactElement => (
  <>
    {getHintKeys(keys).map((symbol) => (
      <kbd className="dg-search-footer-key" key={symbol}>
        {symbol}
      </kbd>
    ))}
  </>
);

const FooterAction = ({
  disabled = false,
  keys,
  label,
  onClick,
}: FooterActionProps): ReactElement => (
  <button
    type="button"
    className="prompt-instruction dg-search-footer-action inline-flex h-auto cursor-pointer items-center gap-[var(--size-4-1)] rounded-none border-0 p-0 disabled:cursor-not-allowed disabled:opacity-50"
    disabled={disabled}
    onClick={onClick}
    // Clicking must not move focus out of the query input, or the arrow keys stop
    // reaching the result list.
    onMouseDown={(event) => event.preventDefault()}
  >
    <KeyHints keys={keys} />
    <span className="ms-[var(--size-4-1)]">{label}</span>
  </button>
);

// Sits in Obsidian's `prompt-instructions` container for its type and spacing.
// Obsidian centres that row for the narrow quick switcher; this footer spans a
// full-width result list, so the actions start at its left edge instead.
export const NodeSearchFooter = ({
  canAct,
  canInsertLink,
  isPreviewOpen,
  onClose,
  onInsertLink,
  onOpenInNewTab,
  onOpenInSplit,
  onTogglePreview,
}: NodeSearchFooterProps): ReactElement => (
  <div className="prompt-instructions dg-search-footer shrink-0 justify-start px-0 pb-0 text-left">
    {/* Absent, not disabled: with no cursor there is nothing to insert into. */}
    {canInsertLink && (
      <FooterAction
        disabled={!canAct}
        keys={["Mod", "Enter"]}
        label="insert link at cursor"
        onClick={onInsertLink}
      />
    )}
    <FooterAction
      disabled={!canAct}
      keys={["Enter"]}
      label="open in new tab"
      onClick={onOpenInNewTab}
    />
    <FooterAction
      disabled={!canAct}
      keys={["Shift", "Enter"]}
      label="open in split"
      onClick={onOpenInSplit}
    />
    <FooterAction
      disabled={!canAct && !isPreviewOpen}
      keys={isPreviewOpen ? ["ArrowLeft"] : ["ArrowRight"]}
      label={isPreviewOpen ? "close preview" : "preview"}
      onClick={onTogglePreview}
    />
    {/* The Escape key itself is handled by Obsidian's modal scope; this button
        is the pointer equivalent, so every footer item responds to a click. */}
    <FooterAction keys={["Escape"]} label="close" onClick={onClose} />
  </div>
);
