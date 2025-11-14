import React from "react";
import PossibleDuplicates from "~/components/PossibleDuplicates";
import { renderReactElement, unmountReactRoot } from "./reactRender";

const CONTAINER_ID = "discourse-graph-possible-duplicates";

export const renderPossibleDuplicates = (
  h1: HTMLHeadingElement,
  title: string,
) => {
  let container = document.getElementById(CONTAINER_ID);

  if (container && container.dataset.pageTitle === title) {
    return;
  }

  if (container) {
    unmountReactRoot(container);
    container.remove();
  }

  const titleContainer = h1.parentElement;
  if (!titleContainer) return;

  container = document.createElement("div");
  container.id = CONTAINER_ID;
  container.dataset.pageTitle = title;

  titleContainer.parentElement?.insertBefore(
    container,
    titleContainer.nextSibling,
  );

  renderReactElement(
    React.createElement(PossibleDuplicates, { pageTitle: title }),
    container,
  );
};
