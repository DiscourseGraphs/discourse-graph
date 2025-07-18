import React from "react";
import ReactDOM from "react-dom";
import { TextSelectionNodeMenu } from "~/components/DiscourseNodeMenu";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import { OnloadArgs } from "roamjs-components/types";

let currentPopupContainer: HTMLDivElement | null = null;

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

export const renderTextSelectionPopup = ({
  extensionAPI,
  blockElement,
  textarea,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
  blockElement: Element;
  textarea: HTMLTextAreaElement;
}) => {
  removeTextSelectionPopup();
  const coords = getCoordsFromTextarea(textarea);
  currentPopupContainer = document.createElement("div");
  currentPopupContainer.id = "discourse-text-selection-popup";
  currentPopupContainer.className =
    "absolute z-[9999] max-w-none font-inherit bg-white";
  currentPopupContainer.style.left = `${coords.left + 50}px`;
  currentPopupContainer.style.top = `${coords.top - 40}px`;

  blockElement.parentElement?.insertBefore(currentPopupContainer, blockElement);

  ReactDOM.render(
    <TextSelectionNodeMenu
      textarea={textarea}
      extensionAPI={extensionAPI}
      onClose={removeTextSelectionPopup}
    />,
    currentPopupContainer,
  );
};

export const removeTextSelectionPopup = () => {
  const container = document.getElementById("discourse-text-selection-popup");
  if (container) {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  }
};
