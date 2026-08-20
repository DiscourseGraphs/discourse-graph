import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
} from "react";
import { DiscourseNode } from "~/types";
import { getAllDiscourseNodeColors } from "~/utils/colorUtils";
import { getHintKeys } from "~/utils/keyboardHints";
import {
  getBestPrefixMatch,
  getCompletionSuffix,
} from "~/utils/nodeTypeChipCompletion";

/** `-1` means the caret is in the query rather than on a chip. */
const NO_FOCUSED_CHIP = -1;

const CHIP_LABEL_MAX_WIDTH = "10rem";
const QUERY_PLACEHOLDER = "Search discourse nodes by title";

type NodeTypeChip = {
  backgroundColor: string;
  id: string;
  name: string;
  textColor: string;
};

const isPlainCharacterKey = (event: KeyboardEvent): boolean =>
  event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;

// An editable span has no selectionStart, so the caret comes from the selection.
const isCaretAtStart = (field: HTMLElement | null): boolean => {
  const selection = field?.ownerDocument.getSelection();
  if (!field || !selection?.isCollapsed || !selection.anchorNode) return false;
  if (!field.contains(selection.anchorNode)) return false;
  return selection.anchorOffset === 0;
};

const setCaretToEnd = (field: HTMLElement): void => {
  const selection = field.ownerDocument.getSelection();
  if (!selection) return;
  const range = field.ownerDocument.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

const NodeTypeChipTag = ({
  chip,
  isFocused,
  onFocusChip,
  onKeyDown,
  onRemove,
  registerRef,
}: {
  chip: NodeTypeChip;
  isFocused: boolean;
  onFocusChip: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => void;
  onRemove: () => void;
  registerRef: (element: HTMLSpanElement | null) => void;
}): ReactElement => (
  // Inline-flex, so a chip shares its line box with the query and wraps alongside it.
  // Out of the tab order: Tab is the commit key, so arrows and Backspace reach chips.
  <span
    ref={registerRef}
    role="button"
    tabIndex={-1}
    aria-label={chip.name}
    title={chip.name}
    contentEditable={false}
    onClick={onFocusChip}
    onKeyDown={onKeyDown}
    style={{ backgroundColor: chip.backgroundColor, color: chip.textColor }}
    className={`mr-1 inline-flex select-none items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-2 pr-1 align-middle text-xs font-semibold ${
      isFocused ? "outline-accent outline outline-2 outline-offset-1" : ""
    }`}
  >
    <span className="truncate" style={{ maxWidth: CHIP_LABEL_MAX_WIDTH }}>
      {chip.name}
    </span>
    {/* `clickable-icon`, because Obsidian's `button:not(.clickable-icon)` rule outranks a utility class and would paint its own box behind the ×. */}
    <button
      type="button"
      tabIndex={-1}
      aria-label={`Remove ${chip.name} filter`}
      onClick={(event) => {
        event.stopPropagation();
        onRemove();
      }}
      onMouseDown={(event) => event.preventDefault()}
      className="clickable-icon !h-4 !w-4 !bg-transparent !p-0 !text-inherit !shadow-none hover:!opacity-70"
    >
      ×
    </button>
  </span>
);

/** Chips and the query caret in one field; `NodeSearch` owns the state and, as an ancestor, already handles the arrows, Enter and Escape that bubble out of here. */
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
  const [focusedChipIndex, setFocusedChipIndex] = useState(NO_FOCUSED_CHIP);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const chipsById = useMemo(() => {
    const byId = new Map<string, NodeTypeChip>();
    getAllDiscourseNodeColors(nodeTypes).forEach(({ nodeType, colors }) => {
      byId.set(nodeType.id, {
        backgroundColor: colors.backgroundColor,
        id: nodeType.id,
        name: nodeType.name,
        textColor: colors.textColor,
      });
    });
    return byId;
  }, [nodeTypes]);

  const chips = useMemo(
    () => selectedNodeTypeIds.flatMap((id) => chipsById.get(id) ?? []),
    [chipsById, selectedNodeTypeIds],
  );

  const bestPrefixMatch = getBestPrefixMatch({
    nodeTypes,
    query,
    selectedTypeIds: selectedNodeTypeIds,
  });

  const completionSuffix = getCompletionSuffix({ bestPrefixMatch, query });

  /**
   * The query text is uncontrolled: React owns the chips but never the editable's
   * content, so re-rendering on each keystroke cannot move the caret. Programmatic
   * changes therefore have to write the text themselves.
   */
  const writeQuery = (value: string): void => {
    const field = inputRef.current;
    if (field) field.textContent = value;
    onQueryChange(value);
  };

  const focusQuery = (): void => {
    setFocusedChipIndex(NO_FOCUSED_CHIP);
    const field = inputRef.current;
    if (!field) return;
    field.focus();
    setCaretToEnd(field);
  };

  useEffect(() => {
    if (focusedChipIndex === NO_FOCUSED_CHIP) return;
    if (focusedChipIndex < selectedNodeTypeIds.length) {
      chipRefs.current[focusedChipIndex]?.focus();
      return;
    }
    // The dropdown can clear the filter mid-focus, stranding focus on a removed node.
    setFocusedChipIndex(NO_FOCUSED_CHIP);
    inputRef.current?.focus();
  }, [focusedChipIndex, inputRef, selectedNodeTypeIds]);

  const commitNodeType = (nodeType: DiscourseNode): void => {
    if (selectedNodeTypeIds.includes(nodeType.id)) return;
    // Raw, not canonicalised: collapsing a full selection would vanish the new chip.
    onSelectedNodeTypeIdsChange([...selectedNodeTypeIds, nodeType.id]);
    writeQuery("");
  };

  const removeChipAt = (chipIndex: number): string[] => {
    const nextIds = selectedNodeTypeIds.filter(
      (_, index) => index !== chipIndex,
    );
    onSelectedNodeTypeIdsChange(nextIds);
    return nextIds;
  };

  const handleChipKeyDown = (
    event: KeyboardEvent<HTMLSpanElement>,
    chipIndex: number,
  ): void => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setFocusedChipIndex(Math.max(0, chipIndex - 1));
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (chipIndex >= selectedNodeTypeIds.length - 1) {
        focusQuery();
        return;
      }
      setFocusedChipIndex(chipIndex + 1);
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const nextIds = removeChipAt(chipIndex);
      if (!nextIds.length) {
        focusQuery();
        return;
      }
      // Backspace walks left, Delete takes the chip that closed the gap: no focus jump.
      const nextIndex =
        event.key === "Backspace"
          ? chipIndex - 1
          : Math.min(chipIndex, nextIds.length - 1);
      if (nextIndex < 0) {
        focusQuery();
        return;
      }
      setFocusedChipIndex(nextIndex);
      return;
    }

    // Typing with a chip focused is a return to the query, not a lost keystroke.
    if (isPlainCharacterKey(event)) {
      event.preventDefault();
      writeQuery(event.key);
      focusQuery();
    }
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

    if (!selectedNodeTypeIds.length) return;
    if (!isCaretAtStart(inputRef.current)) return;

    // Highlight first, so an over-eager Backspace cannot silently drop a filter.
    if (event.key === "Backspace" && !query.length) {
      event.preventDefault();
      setFocusedChipIndex(selectedNodeTypeIds.length - 1);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setFocusedChipIndex(selectedNodeTypeIds.length - 1);
    }
  };

  return (
    <div
      // A block box, not a flex row: chips and the query are inline siblings, so they
      // share line boxes and flow together left to right, top to bottom.
      // `border-solid` is not redundant: this build omits `@tailwind base`, so there is
      // no preflight setting a default border style and `border` alone renders nothing.
      className="border-modifier-border bg-modifier-form-field min-h-[calc(var(--font-ui-medium)*var(--line-height-tight)_+_12px)] min-w-0 flex-1 cursor-text rounded-[var(--input-radius)] border border-solid px-2 py-1 text-[length:var(--font-ui-medium)] leading-[var(--line-height-tight)] focus-within:border-[color:var(--background-modifier-border-focus)] hover:border-[color:var(--background-modifier-border-hover)]"
      onClick={() => {
        if (focusedChipIndex === NO_FOCUSED_CHIP) focusQuery();
      }}
    >
      {chips.map((chip, index) => (
        <NodeTypeChipTag
          key={chip.id}
          chip={chip}
          isFocused={focusedChipIndex === index}
          onFocusChip={() => setFocusedChipIndex(index)}
          onKeyDown={(event) => handleChipKeyDown(event, index)}
          onRemove={() => {
            removeChipAt(index);
            focusQuery();
          }}
          registerRef={(element) => {
            chipRefs.current[index] = element;
          }}
        />
      ))}
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
      {/* Inline rather than an overlay, so it follows the caret and wraps with the text. */}
      {!!bestPrefixMatch && (
        <span aria-hidden className="align-middle">
          <span className="text-muted">{completionSuffix}</span>
          <kbd className="dg-search-footer-key ml-2">
            {getHintKeys(["Tab"])[0]}
          </kbd>
        </span>
      )}
      {!query && !chips.length && (
        <span aria-hidden className="text-muted pointer-events-none">
          {QUERY_PLACEHOLDER}
        </span>
      )}
    </div>
  );
};
