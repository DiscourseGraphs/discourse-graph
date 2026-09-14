import type { KeyboardEvent, ReactElement, RefObject } from "react";
import { DiscourseNode } from "~/types";
import { getHintKeys } from "~/utils/keyboardHints";
import {
  getBestPrefixMatch,
  getCompletionSuffix,
} from "~/utils/nodeTypeChipCompletion";

const QUERY_PLACEHOLDER = "Search discourse nodes by title";

export const setCaretToEnd = (field: HTMLElement): void => {
  const selection = field.ownerDocument.getSelection();
  if (!selection) return;
  const range = field.ownerDocument.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

/** So ArrowRight can be repurposed to open the preview only once typing can't go any further right. */
export const isCaretAtEnd = (field: HTMLElement | null): boolean => {
  const selection = field?.ownerDocument.getSelection();
  if (!field || !selection?.isCollapsed || selection.rangeCount === 0) {
    return false;
  }
  const endOfField = field.ownerDocument.createRange();
  endOfField.selectNodeContents(field);
  endOfField.collapse(false);
  return (
    selection.getRangeAt(0).compareBoundaryPoints(Range.END_TO_END, endOfField) === 0
  );
};

/**
 * Plain title-query input with type-ahead: typing a node type's name and
 * pressing Tab adds it as a filter (rendered by `NodeTypeFilterTags`, not here).
 * `NodeSearch` owns the filter state, and as an ancestor already handles the
 * arrows, Enter and Escape that bubble out of here.
 */
export const NodeTypeChipsSearchInput = ({
  inputRef,
  nodeTypes,
  onQueryChange,
  onSelectedNodeTypeIdsChange,
  query,
  selectedNodeTypeIds,
}: {
  inputRef: RefObject<HTMLSpanElement | null>;
  nodeTypes: DiscourseNode[];
  onQueryChange: (query: string) => void;
  onSelectedNodeTypeIdsChange: (ids: string[]) => void;
  query: string;
  selectedNodeTypeIds: string[];
}): ReactElement => {
  const bestPrefixMatch = getBestPrefixMatch({
    nodeTypes,
    query,
    selectedTypeIds: selectedNodeTypeIds,
  });

  const completionSuffix = getCompletionSuffix({ bestPrefixMatch, query });

  // Uncontrolled, so re-rendering cannot move the caret — hence writing the text by hand.
  const writeQuery = (value: string): void => {
    const field = inputRef.current;
    if (field) field.textContent = value;
    onQueryChange(value);
  };

  const commitNodeType = (nodeType: DiscourseNode): void => {
    if (selectedNodeTypeIds.includes(nodeType.id)) return;
    onSelectedNodeTypeIdsChange([...selectedNodeTypeIds, nodeType.id]);
    writeQuery("");
  };

  const handleQueryKeyDown = (event: KeyboardEvent<HTMLSpanElement>): void => {
    // Suppress the line break only; Enter still bubbles, and modified Enter reaches nothing else.
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault();
    }

    if (event.key === "Tab") {
      // With nothing pending, Tab is left alone so it still reaches the footer actions.
      if (!bestPrefixMatch) return;
      event.preventDefault();
      commitNodeType(bestPrefixMatch);
      return;
    }

    // Empty query only, so backspacing through query text never touches filters.
    if (event.key === "Backspace" && !query && selectedNodeTypeIds.length > 0) {
      event.preventDefault();
      onSelectedNodeTypeIdsChange(selectedNodeTypeIds.slice(0, -1));
    }
  };

  return (
    <div
      // `border-solid` is required: with no `@tailwind base`, `border` sets width but no style.
      // `relative`, so the ghost-completion overlay below anchors to this box.
      className="border-modifier-border bg-modifier-form-field relative min-h-[calc(var(--font-ui-medium)*var(--line-height-tight)_+_12px)] min-w-0 flex-1 cursor-text rounded-[var(--input-radius)] border border-solid px-[var(--size-4-2)] py-[var(--size-4-1)] text-[length:var(--font-ui-medium)] leading-[var(--line-height-tight)] focus-within:border-[color:var(--background-modifier-border-focus)] hover:border-[color:var(--background-modifier-border-hover)]"
      // Padding clicks only: elsewhere the browser has already placed the caret.
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          inputRef.current?.focus();
          if (inputRef.current) setCaretToEnd(inputRef.current);
        }
      }}
    >
      {/* `plaintext-only` so a pasted selection cannot bring markup in with it. */}
      <span
        ref={inputRef}
        contentEditable="plaintext-only"
        role="textbox"
        aria-label={QUERY_PLACEHOLDER}
        spellCheck={false}
        suppressContentEditableWarning
        onInput={(event) =>
          onQueryChange(event.currentTarget.textContent ?? "")
        }
        onKeyDown={handleQueryKeyDown}
        className="dg-search-chip-input whitespace-pre-wrap break-words align-middle outline-none"
      />
      {!!bestPrefixMatch && (
        // An absolutely-positioned overlay, not inline content: an inline ghost
        // suffix widened the box to fit itself, growing and shrinking the whole
        // search field as you typed. An invisible echo of the query establishes
        // the same horizontal offset the real text occupies, so the suffix lines
        // up right after it without ever entering the box's own layout.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre-wrap break-words px-[var(--size-4-2)] py-[var(--size-4-1)]"
        >
          <span className="invisible">{query}</span>
          <span className="text-muted">{completionSuffix}</span>
          <kbd className="dg-search-footer-key ml-[var(--size-4-2)]">
            {getHintKeys(["Tab"])[0]}
          </kbd>
        </div>
      )}
      {!query && (
        <span aria-hidden className="text-muted pointer-events-none">
          {QUERY_PLACEHOLDER}
        </span>
      )}
    </div>
  );
};
