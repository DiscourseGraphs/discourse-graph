import React from "react";
import ReactDOM from "react-dom";
import { TextSelectionPopup } from "~/components/TextSelectionPopup";

let currentPopupContainer: HTMLSpanElement | null = null;

const getCoordsFromSelection = (): { left: number; top: number } => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { left: 0, top: 0 };
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Calculate coordinates relative to the document, not viewport
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  return {
    left: rect.left + scrollLeft + rect.width / 2, // Center horizontally
    top: rect.top + scrollTop - 5, // 5px above selection
  };
};

export const renderTextSelectionPopup = (
  selectedText: string,
  selectionRect: DOMRect,
  onNodeTypeSelect: (nodeType: string, selectedText: string) => void,
) => {
  // Remove existing popup if any
  removeTextSelectionPopup();

  // Find the block element containing the selection (following the established pattern)
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;

  // Find the closest block element to insert before (same logic as in selection listener)
  let blockElement: Element | null = null;
  let currentElement =
    commonAncestor.nodeType === Node.TEXT_NODE
      ? commonAncestor.parentElement
      : (commonAncestor as Element);

  while (currentElement && currentElement !== document.body) {
    if (
      currentElement.classList?.contains("rm-block-text") ||
      currentElement.classList?.contains("rm-block-input") ||
      currentElement.closest(".rm-autocomplete__wrapper")
    ) {
      blockElement = currentElement;
      break;
    }
    currentElement = currentElement.parentElement;
  }

  if (!blockElement) return;

  // Create container following the DiscourseNodeMenu pattern
  currentPopupContainer = document.createElement("span");
  const coords = getCoordsFromSelection();
  currentPopupContainer.style.position = "absolute";
  currentPopupContainer.style.left = `${coords.left}px`;
  currentPopupContainer.style.top = `${coords.top}px`;
  currentPopupContainer.style.transform = "translateX(-50%)"; // Center the popup
  currentPopupContainer.style.zIndex = "9999";

  // Insert before the block element (following the established pattern)
  blockElement.parentElement?.insertBefore(currentPopupContainer, blockElement);

  // Render popup using ReactDOM.render (following the established pattern)
  ReactDOM.render(
    <TextSelectionPopup
      selectedText={selectedText}
      selectionRect={selectionRect}
      onClose={removeTextSelectionPopup}
      onNodeTypeSelect={onNodeTypeSelect}
    />,
    currentPopupContainer,
  );
};

export const removeTextSelectionPopup = () => {
  if (currentPopupContainer) {
    ReactDOM.unmountComponentAtNode(currentPopupContainer);
    currentPopupContainer.remove(); // Following the pattern from DiscourseNodeMenu
    currentPopupContainer = null;
  }
};
