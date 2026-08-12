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

// Roam's footer renders each key as a bordered cap rather than bold text, which
// keeps `esc` reading as one of the set instead of standing out. Deliberately
// not `prompt-instruction-command`, whose weight is what makes it stand out.
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
    <span className="dg-search-footer-label">{label}</span>
  </button>
);

// Sits in Obsidian's `prompt-instructions` container for its type and spacing,
// but styles the keys as Roam's search footer does.
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
    <span className="prompt-instruction dg-search-footer-hint">
      <KeyHints keys={["Escape"]} />
      <span className="dg-search-footer-label">close</span>
    </span>
  </div>
);
