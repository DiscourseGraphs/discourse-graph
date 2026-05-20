import React from "react";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import { getPageTitleValueByHtmlElement } from "roamjs-components/dom";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { TldrawCanvas } from "./Tldraw";

const BLOCK_TEXT_REGEX = /\{\{dg-canvas:\s*\[\[(.+?)\]\]\s*\}\}/i;

const extractCanvasTitle = (button: HTMLElement): string | null => {
  const blockUid = getBlockUidFromTarget(button);
  if (!blockUid) return null;
  const blockText = getTextByBlockUid(blockUid);
  if (!blockText) return null;
  const match = blockText.match(BLOCK_TEXT_REGEX);
  if (!match) return null;
  return match[1].trim();
};

const getCurrentPageTitle = (el: HTMLElement): string | null => {
  try {
    return getPageTitleValueByHtmlElement(el);
  } catch {
    return null;
  }
};

const CanvasEmbedPlaceholder = ({ message }: { message: string }) => (
  <div className="dg-canvas-embed-placeholder">{message}</div>
);

export const renderCanvasEmbed = (
  button: HTMLElement,
  onloadArgs: OnloadArgs,
) => {
  button.classList.add("dg-canvas-embed-source-hidden");

  if (!button.parentElement) return;

  const title = extractCanvasTitle(button);
  if (!title) return;

  const currentPageTitle = getCurrentPageTitle(button);
  if (currentPageTitle === title) {
    const wrapper = document.createElement("div");
    button.parentElement.appendChild(wrapper);
    renderWithUnmount(
      <CanvasEmbedPlaceholder message="Cannot embed a canvas within itself" />,
      wrapper,
    );
    return;
  }

  const pageUid = getPageUidByPageTitle(title);
  if (!pageUid) {
    const wrapper = document.createElement("div");
    button.parentElement.appendChild(wrapper);
    renderWithUnmount(
      <CanvasEmbedPlaceholder message={`Canvas not found: ${title}`} />,
      wrapper,
    );
    return;
  }

  button.parentElement.onmousedown = (e: MouseEvent) => e.stopPropagation();

  const wrapper = document.createElement("div");
  wrapper.className = "dg-canvas-embed";
  button.parentElement.appendChild(wrapper);

  renderWithUnmount(
    <ExtensionApiContextProvider {...onloadArgs}>
      <TldrawCanvas title={title} />
    </ExtensionApiContextProvider>,
    wrapper,
  );
};
