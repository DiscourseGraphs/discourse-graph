import React from "react";
import ReactDOM from "react-dom";

const ROAM_TITLE_CONTAINER_CLASS = "rm-title-display-container";
const ADDITIONS_CONTAINER_CLASS = "discourse-graph-title-additions";
const INLINE_ADDITION_CLASS = "discourse-graph-title-addition-inline";
const BLOCK_ADDITION_CLASS = "discourse-graph-title-addition-block";

type TitleAdditionLayout = "inline" | "block";

export const handleTitleAdditions = (
  h1: HTMLHeadingElement,
  element: React.ReactNode,
  { layout = "block" }: { layout?: TitleAdditionLayout } = {},
): void => {
  const titleDisplayContainer =
    h1.closest(`.${ROAM_TITLE_CONTAINER_CLASS}`) ||
    (h1.parentElement?.classList.contains(ROAM_TITLE_CONTAINER_CLASS)
      ? h1.parentElement
      : null);
  if (!titleDisplayContainer) return;

  let container =
    titleDisplayContainer.parentElement?.querySelector<HTMLElement>(
      `.${ADDITIONS_CONTAINER_CLASS}`,
    ) ?? null;

  if (!container) {
    const parent = titleDisplayContainer.parentElement;
    if (!parent) return;

    container = document.createElement("div");
    container.className = ADDITIONS_CONTAINER_CLASS;

    const oldMarginBottom = getComputedStyle(h1).marginBottom;
    const oldMarginBottomNum = Number.isFinite(parseFloat(oldMarginBottom))
      ? parseFloat(oldMarginBottom)
      : 0;
    const newMarginTop = `${4 - oldMarginBottomNum / 2}px`;

    container.style.marginTop = newMarginTop;
    container.style.marginBottom = oldMarginBottom;

    if (parent.lastElementChild === titleDisplayContainer) {
      parent.appendChild(container);
    } else {
      parent.insertBefore(container, titleDisplayContainer.nextElementSibling);
    }
  }

  if (React.isValidElement(element)) {
    const renderContainer = document.createElement("div");
    renderContainer.className =
      layout === "inline" ? INLINE_ADDITION_CLASS : BLOCK_ADDITION_CLASS;
    container.appendChild(renderContainer);
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.render(element, renderContainer);
  } else if (element instanceof Node) {
    container.appendChild(element);
  } else if (element !== null && element !== undefined) {
    // For other ReactNode types (string, number, etc.), create a text node
    const textNode = document.createTextNode(String(element));
    container.appendChild(textNode);
  }
};
