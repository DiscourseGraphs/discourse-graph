import { type ReactElement } from "react";
import { getHintKeys, type HintKey } from "~/utils/keyboardHints";

type NodeSearchFooterProps = {
  canAct: boolean;
  onOpenInNewTab: () => void;
  onOpenInSplit: () => void;
};

type FooterActionProps = {
  disabled: boolean;
  keys: HintKey[];
  label: string;
  onClick: () => void;
};

const KeyHints = ({ keys }: { keys: HintKey[] }): ReactElement => (
  <>
    {getHintKeys(keys).map((symbol) => (
      <span className="prompt-instruction-command" key={symbol}>
        {symbol}
      </span>
    ))}
  </>
);

const FooterAction = ({
  disabled,
  keys,
  label,
  onClick,
}: FooterActionProps): ReactElement => (
  <button
    type="button"
    className="prompt-instruction dg-search-footer-action"
    disabled={disabled}
    onClick={onClick}
    // Same reason as the result rows: keep focus in the query input so arrow-key
    // navigation still works after a click.
    onMouseDown={(event) => event.preventDefault()}
  >
    <KeyHints keys={keys} />
    <span>{label}</span>
  </button>
);

// Reuses Obsidian's own `prompt-instruction` markup, the same classes
// `SuggestModal.setInstructions()` emits, so the footer matches the native
// quick switcher. This modal extends plain `Modal`, so that API is unavailable.
export const NodeSearchFooter = ({
  canAct,
  onOpenInNewTab,
  onOpenInSplit,
}: NodeSearchFooterProps): ReactElement => (
  <div className="prompt-instructions dg-search-footer">
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
    {/* Escape is handled by Obsidian's modal scope, so this is a hint only. */}
    <span className="prompt-instruction">
      <KeyHints keys={["Escape"]} />
      <span>close</span>
    </span>
  </div>
);
