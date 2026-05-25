import React from "react";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
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

const CanvasEmbedPlaceholder = ({ message }: { message: string }) => (
  <div
    className="flex items-center justify-center rounded-md border border-dashed border-gray-300 text-sm"
    style={{ height: "100px" }}
  >
    {message}
  </div>
);

export const renderCanvasEmbed = (
  button: HTMLElement,
  onloadArgs: OnloadArgs,
) => {
  button.hidden = true;

  if (!button.parentElement) return;

  const title = extractCanvasTitle(button);
  if (!title) return;

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

  const wrapper = document.createElement("div");
  wrapper.className = "dg-canvas-embed my-2 w-full overflow-hidden rounded-md";
  wrapper.style.height = "400px";
  wrapper.onmousedown = (e: MouseEvent) => e.stopPropagation();
  button.parentElement.appendChild(wrapper);

  renderWithUnmount(
    <ExtensionApiContextProvider {...onloadArgs}>
      <TldrawCanvas title={title} />
    </ExtensionApiContextProvider>,
    wrapper,
  );
};
