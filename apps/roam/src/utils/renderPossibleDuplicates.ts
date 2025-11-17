import React from "react";
import ReactDOM from "react-dom";
import LlmFilteredDuplicates from "~/components/LlmFilteredDuplicates";
import VectorDuplicateMatches from "~/components/VectorDuplicateMatches";

const OLD_CONTAINER_ID = "discourse-graph-possible-duplicates";
const LLM_CONTAINER_ID = "discourse-graph-duplicates-llm";
const VECTOR_CONTAINER_ID = "discourse-graph-duplicates-vector";

export const renderPossibleDuplicates = (
  h1: HTMLHeadingElement,
  title: string,
) => {
  // Clean up old single-container version if present
  const oldContainer = document.getElementById(OLD_CONTAINER_ID);
  if (oldContainer) {
    try {
      ReactDOM.unmountComponentAtNode(oldContainer);
    } catch {
      // ignore
    }
    oldContainer.remove();
  }

  const titleContainer = h1.parentElement;
  if (!titleContainer) return;

  // Ensure or recreate LLM container
  let llmContainer = document.getElementById(LLM_CONTAINER_ID);
  if (llmContainer && llmContainer.dataset.pageTitle !== title) {
    try {
      ReactDOM.unmountComponentAtNode(llmContainer);
    } catch {
      // ignore
    }
    llmContainer.remove();
    llmContainer = null;
  }
  if (!llmContainer) {
    llmContainer = document.createElement("div");
    llmContainer.id = LLM_CONTAINER_ID;
    llmContainer.dataset.pageTitle = title;
    titleContainer.parentElement?.insertBefore(
      llmContainer,
      titleContainer.nextSibling,
    );
  }

  // Ensure or recreate Vector container
  let vectorContainer = document.getElementById(VECTOR_CONTAINER_ID);
  if (vectorContainer && vectorContainer.dataset.pageTitle !== title) {
    try {
      ReactDOM.unmountComponentAtNode(vectorContainer);
    } catch {
      // ignore
    }
    vectorContainer.remove();
    vectorContainer = null;
  }
  if (!vectorContainer) {
    vectorContainer = document.createElement("div");
    vectorContainer.id = VECTOR_CONTAINER_ID;
    vectorContainer.dataset.pageTitle = title;
    llmContainer.insertAdjacentElement("afterend", vectorContainer);
  }

  ReactDOM.render(
    React.createElement(LlmFilteredDuplicates, { pageTitle: title }),
    llmContainer,
  );
  ReactDOM.render(
    React.createElement(VectorDuplicateMatches, { pageTitle: title }),
    vectorContainer,
  );
};
