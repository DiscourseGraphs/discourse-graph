import React from "react";
import ReactDOM from "react-dom";
import { TextSelectionNodeMenu } from "~/components/DiscourseNodeMenu";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import { OnloadArgs } from "roamjs-components/types";

let currentPopupContainer: HTMLSpanElement | null = null;

export const findBlockElementFromSelection = (): Element | null => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const commonAncestor = range.commonAncestorContainer;

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

  return blockElement;
};

export const renderTextSelectionPopup = (
  extensionAPI: OnloadArgs["extensionAPI"],
  blockElement?: Element | null,
  textarea?: HTMLTextAreaElement | null,
) => {
  removeTextSelectionPopup();
  const targetBlockElement = blockElement || findBlockElementFromSelection();
  if (!targetBlockElement) return;

  const targetTextarea =
    textarea || targetBlockElement.querySelector("textarea");
  if (!targetTextarea) return;

  const coords = getCoordsFromTextarea(targetTextarea);
  console.log(coords);

  currentPopupContainer = document.createElement("div");
  currentPopupContainer.id = "discourse-text-selection-popup";
  currentPopupContainer.className = "discourse-text-selection-popup";
  currentPopupContainer.style.position = "absolute";
  currentPopupContainer.style.left = `${coords.left + 50}px`;
  currentPopupContainer.style.top = `${coords.top - 40}px`;
  currentPopupContainer.style.zIndex = "9999";

  targetBlockElement.parentElement?.insertBefore(
    currentPopupContainer,
    targetBlockElement,
  );

  ReactDOM.render(
    <TextSelectionNodeMenu
      textarea={targetTextarea}
      extensionAPI={extensionAPI}
      onClose={removeTextSelectionPopup}
    />,
    currentPopupContainer,
  );
};

export const removeTextSelectionPopup = () => {
  if (currentPopupContainer) {
    ReactDOM.unmountComponentAtNode(currentPopupContainer);
    currentPopupContainer.remove();
    currentPopupContainer = null;
  }
};
