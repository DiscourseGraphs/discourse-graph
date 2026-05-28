import { Classes, Tag } from "@blueprintjs/core";
import React, { useEffect, useRef, useState } from "react";
import { getNodeTagColorStyles } from "~/utils/getDiscourseNodeColors";
import { type DiscourseNode } from "~/utils/getDiscourseNodes";

type NodeTypeChipsSearchInputProps = {
  nodeTypes: DiscourseNode[];
  searchTerm: string;
  selectedTypeIds: string[];
  inputRef: React.RefObject<HTMLInputElement>;
  onSearchTermChange: (value: string) => void;
  onSelectedTypeIdsChange: (ids: string[]) => void;
  onArrowDown: () => void;
  onArrowUp: () => void;
  onEnter: () => void;
  onShiftEnter: () => void;
  onCmdEnter: () => void;
  onEscape: () => void;
};

const CHIP_LABEL_MAX_WIDTH = "10rem";
const INPUT_MIN_WIDTH = "12ch";

const isPlainCharacterKey = (event: React.KeyboardEvent): boolean =>
  event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;

const getBestPrefixMatch = ({
  nodeTypes,
  query,
  selectedTypeIds,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
  selectedTypeIds: string[];
}): DiscourseNode | null => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return null;

  const selectedTypeIdSet = new Set(selectedTypeIds);
  const matches = nodeTypes.filter(
    (node) =>
      !selectedTypeIdSet.has(node.type) &&
      node.text.toLowerCase().startsWith(normalizedQuery),
  );

  if (!matches.length) return null;

  const exactMatch = matches.find(
    (node) => node.text.toLowerCase() === normalizedQuery,
  );
  return exactMatch ?? matches[0];
};

const getCompletionSuffix = ({
  bestPrefixMatch,
  searchTerm,
}: {
  bestPrefixMatch: DiscourseNode | null;
  searchTerm: string;
}): string => {
  if (!bestPrefixMatch) return "";
  const normalizedQuery = searchTerm.trim();
  const nodeText = bestPrefixMatch.text;
  if (nodeText.toLowerCase() === normalizedQuery.toLowerCase()) return "";
  return nodeText.slice(normalizedQuery.length);
};

export const NodeTypeChipsSearchInput = ({
  nodeTypes,
  searchTerm,
  selectedTypeIds,
  inputRef,
  onSearchTermChange,
  onSelectedTypeIdsChange,
  onArrowDown,
  onArrowUp,
  onEnter,
  onShiftEnter,
  onCmdEnter,
  onEscape,
}: NodeTypeChipsSearchInputProps): React.ReactElement => {
  const [focusedChipIndex, setFocusedChipIndex] = useState(-1);
  const chipRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const nodeTypeById = Object.fromEntries(
    nodeTypes.map((nodeType) => [nodeType.type, nodeType]),
  ) as Record<string, DiscourseNode | undefined>;

  const selectedNodeTypes = selectedTypeIds
    .map((typeId) => nodeTypeById[typeId])
    .filter((nodeType): nodeType is DiscourseNode => !!nodeType);

  const bestPrefixMatch = getBestPrefixMatch({
    nodeTypes,
    query: searchTerm,
    selectedTypeIds,
  });

  const completionSuffix = getCompletionSuffix({ bestPrefixMatch, searchTerm });

  useEffect(() => {
    if (focusedChipIndex < 0) return;
    chipRefs.current[focusedChipIndex]?.focus();
  }, [focusedChipIndex]);

  const focusInput = (): void => {
    setFocusedChipIndex(-1);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const commitNodeType = (nodeType: DiscourseNode): void => {
    if (selectedTypeIds.includes(nodeType.type)) return;
    onSelectedTypeIdsChange([...selectedTypeIds, nodeType.type]);
    onSearchTermChange("");
  };

  const handleChipKeyDown = (
    event: React.KeyboardEvent<HTMLSpanElement>,
    chipIndex: number,
  ): void => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setFocusedChipIndex(Math.max(0, chipIndex - 1));
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (chipIndex >= selectedTypeIds.length - 1) {
        focusInput();
        return;
      }
      setFocusedChipIndex(chipIndex + 1);
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      const nextIds = selectedTypeIds.filter((_, index) => index !== chipIndex);
      onSelectedTypeIdsChange(nextIds);
      if (nextIds.length === 0) {
        focusInput();
        return;
      }
      if (event.key === "Backspace") {
        setFocusedChipIndex(Math.max(0, chipIndex - 1));
        return;
      }
      if (chipIndex >= nextIds.length) {
        focusInput();
        return;
      }
      setFocusedChipIndex(chipIndex);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onArrowDown();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onArrowUp();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
      return;
    }
    if (isPlainCharacterKey(event)) {
      event.preventDefault();
      onSearchTermChange(event.key);
      focusInput();
    }
  };

  const handleInputKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ): void => {
    if (event.key === "Tab") {
      if (bestPrefixMatch) {
        event.preventDefault();
        commitNodeType(bestPrefixMatch);
      }
      return;
    }

    if (event.key === "Backspace") {
      const input = inputRef.current;
      if (
        input &&
        input.selectionStart === 0 &&
        input.selectionEnd === 0 &&
        searchTerm.length === 0 &&
        selectedTypeIds.length > 0
      ) {
        event.preventDefault();
        setFocusedChipIndex(selectedTypeIds.length - 1);
        return;
      }
    }

    if (event.key === "ArrowLeft") {
      const input = inputRef.current;
      if (
        input &&
        input.selectionStart === 0 &&
        input.selectionEnd === 0 &&
        selectedTypeIds.length > 0
      ) {
        event.preventDefault();
        setFocusedChipIndex(selectedTypeIds.length - 1);
        return;
      }
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      onArrowDown();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      onArrowUp();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.metaKey || event.ctrlKey) onCmdEnter();
      else if (event.shiftKey) onShiftEnter();
      else onEnter();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onEscape();
    }
  };

  return (
    <div
      className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-1 py-0.5"
      style={{ flex: "1 1 0", minWidth: 0, width: "100%" }}
    >
      {selectedNodeTypes.map((nodeType, index) => {
        const isFocused = focusedChipIndex === index;
        return (
          <span
            key={nodeType.type}
            ref={(element) => {
              chipRefs.current[index] = element;
            }}
            role="button"
            tabIndex={-1}
            onClick={() => setFocusedChipIndex(index)}
            onKeyDown={(event) => handleChipKeyDown(event, index)}
            style={{
              borderRadius: 3,
              boxShadow: isFocused
                ? "0 0 0 2px rgba(95, 87, 192, 0.2)"
                : undefined,
              display: "inline-flex",
            }}
          >
            <Tag
              active={isFocused}
              htmlTitle={nodeType.text}
              minimal
              onRemove={(event) => {
                event.stopPropagation();
                onSelectedTypeIdsChange(
                  selectedTypeIds.filter((_, chipIndex) => chipIndex !== index),
                );
                focusInput();
              }}
              style={{
                ...getNodeTagColorStyles(
                  nodeType.canvasSettings?.color ?? "#000000",
                ),
                alignItems: "center",
                display: "inline-flex",
                flexDirection: "row",
              }}
            >
              <span
                className="truncate"
                style={{ maxWidth: CHIP_LABEL_MAX_WIDTH }}
              >
                {nodeType.text}
              </span>
            </Tag>
          </span>
        );
      })}
      <span
        className="relative min-w-0 flex-1"
        style={{ minWidth: INPUT_MIN_WIDTH }}
      >
        {completionSuffix && (
          <span className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-sm">
            <span className="invisible">{searchTerm}</span>
            <span className="text-gray-400">{completionSuffix}</span>
            <span className="ml-2 rounded bg-gray-100 px-1 text-xs uppercase tracking-wide text-gray-500">
              Tab
            </span>
          </span>
        )}
        <input
          className={`${Classes.INPUT} w-full border-none bg-transparent px-0 py-0 text-sm shadow-none outline-none placeholder:text-gray-400 focus:shadow-none`}
          onChange={(event) => onSearchTermChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            selectedTypeIds.length ? "" : "Search discourse nodes..."
          }
          ref={inputRef}
          spellCheck={false}
          value={searchTerm}
        />
      </span>
    </div>
  );
};
