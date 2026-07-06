import React from "react";
import { Button } from "@blueprintjs/core";
import posthog from "posthog-js";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types";
import renderWithUnmount from "roamjs-components/util/renderWithUnmount";
import getBlockUidFromTarget from "roamjs-components/dom/getBlockUidFromTarget";
import getUids from "roamjs-components/dom/getUids";
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

const handleEditBlock = (location: { blockUid: string; windowId: string }) => {
  posthog.capture("Canvas Embed: Edit Block Clicked");
  void window.roamAlphaAPI.ui.setBlockFocusAndSelection({
    location: {
      "block-uid": location.blockUid,
      "window-id": location.windowId,
    },
  });
};

const CanvasEmbedChrome = ({
  title,
  location,
}: {
  title: string;
  location: { blockUid: string; windowId: string };
}) => (
  <div className="relative h-full w-full">
    <TldrawCanvas title={title} />
    <Button
      className="absolute right-2 top-2 z-20"
      icon="edit"
      minimal
      small
      title="Edit Block"
      onClick={() => handleEditBlock(location)}
    />
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

  const location = getUids(button.closest<HTMLDivElement>(".roam-block"));

  const wrapper = document.createElement("div");
  wrapper.className = "dg-canvas-embed my-2 w-full overflow-hidden rounded-md";
  wrapper.style.height = "400px";
  wrapper.onmousedown = (e: MouseEvent) => e.stopPropagation();
  button.parentElement.appendChild(wrapper);

  renderWithUnmount(
    <ExtensionApiContextProvider {...onloadArgs}>
      <CanvasEmbedChrome title={title} location={location} />
    </ExtensionApiContextProvider>,
    wrapper,
  );
};
