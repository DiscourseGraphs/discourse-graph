import React from "react";
import ReactDOM from "react-dom";
import { TextSelectionNodeMenu } from "~/components/DiscourseNodeMenu";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import { OnloadArgs } from "roamjs-components/types";

let currentPopupContainer: HTMLSpanElement | null = null;

export const renderTextSelectionPopup = (
  selectedText: string,
  selectionRect: DOMRect,
  onNodeTypeSelect: (nodeType: string, selectedText: string) => void,
  discourseNodes: Array<{
    type: string;
    text: string;
    canvasSettings: { color?: string };
  }>,
  extensionAPI: OnloadArgs["extensionAPI"],
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

  // Find the textarea element
  const textarea = blockElement.querySelector("textarea");
  if (!textarea) return;

  // Get coordinates using the existing utility
  const coords = getCoordsFromTextarea(textarea);

  // Calculate the center of the selected text
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const selectedTextLength = selectionEnd - selectionStart;

  // Estimate character width to center over the selection
  const computedStyle = window.getComputedStyle(textarea);
  const fontSize = parseInt(computedStyle.fontSize) || 14;
  const charWidth = fontSize * 0.6; // Approximate character width

  // Adjust coordinates to center over the selected text
  const selectionCenterOffset = (selectedTextLength * charWidth) / 2;
  const centeredLeft = coords.left + selectionCenterOffset;

  // Create container following the DiscourseNodeMenu pattern
  currentPopupContainer = document.createElement("div");
  currentPopupContainer.style.position = "absolute";
  currentPopupContainer.style.left = `${centeredLeft}px`;
  currentPopupContainer.style.top = `${coords.top - parseInt(computedStyle.height) - 5}px`;
  currentPopupContainer.style.zIndex = "9999";
  currentPopupContainer.style.transform = "translateX(-50%)"; // Center the popup horizontally

  // Insert before the block element (following the established pattern)
  blockElement.parentElement?.insertBefore(currentPopupContainer, blockElement);

  // Render popup using the new TextSelectionNodeMenu
  ReactDOM.render(
    <TextSelectionNodeMenu
      selectedText={selectedText}
      textarea={textarea}
      extensionAPI={extensionAPI}
      onClose={removeTextSelectionPopup}
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
