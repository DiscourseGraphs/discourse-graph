import React from "react";
import ReactDOM from "react-dom";
import PossibleDuplicates from "~/components/PossibleDuplicates";

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
    ReactDOM.unmountComponentAtNode(container);
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

  ReactDOM.render(
    React.createElement(PossibleDuplicates, { pageTitle: title }),
    container,
  );
};
