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
import { findCanvasFrameRef } from "./CanvasFrameEmbed";
import { CanvasFrameEmbedRouter } from "./CanvasFrameSnapshot";
import { parseDgCanvasEmbed } from "~/utils/dgCanvasEmbed";

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

// The whole-canvas embed, with an inline "Edit Block" button so the user can
// jump to the source block from the mounted canvas.
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
      className="absolute bottom-2 right-8 z-20"
      icon="edit"
      minimal
      small
      title="Edit Block"
      onClick={() => handleEditBlock(location)}
    />
  </div>
);

// `{{dg-canvas: [[Title]]}}` renders the classic whole-canvas embed. An
// optional frame argument (`"Frame Name"` and/or `shape:ID`) routes to the
// frame-anchored embed instead — but only when it maps to a real frame on the
// canvas; malformed or unmatched frame arguments are ignored so the embed
// always degrades to just showing the canvas.
export const renderCanvasEmbed = (
  button: HTMLElement,
  onloadArgs: OnloadArgs,
) => {
  button.hidden = true;

  if (!button.parentElement) return;

  const blockUid = getBlockUidFromTarget(button);
  if (!blockUid) return;
  const blockText = getTextByBlockUid(blockUid);
  const parsed = blockText ? parseDgCanvasEmbed(blockText) : null;
  if (!parsed) return;

  const pageUid = getPageUidByPageTitle(parsed.title);
  if (!pageUid) {
    const wrapper = document.createElement("div");
    button.parentElement.appendChild(wrapper);
    renderWithUnmount(
      <CanvasEmbedPlaceholder message={`Canvas not found: ${parsed.title}`} />,
      wrapper,
    );
    return;
  }

  const frame = findCanvasFrameRef({
    pageUid,
    frameName: parsed.frameName,
    frameShapeId: parsed.frameShapeId,
  });
  const location = getUids(button.closest<HTMLDivElement>(".roam-block"));

  const wrapper = document.createElement("div");
  wrapper.className = frame
    ? "dg-frame-embed my-2 w-full overflow-hidden rounded-md"
    : "dg-canvas-embed my-2 w-full overflow-hidden rounded-md";
  wrapper.style.height = "400px";
  wrapper.onmousedown = (e: MouseEvent) => e.stopPropagation();
  button.parentElement.appendChild(wrapper);

  renderWithUnmount(
    <ExtensionApiContextProvider {...onloadArgs}>
      {frame ? (
        <CanvasFrameEmbedRouter
          title={parsed.title}
          pageUid={pageUid}
          frame={frame}
          live={parsed.live}
        />
      ) : (
        <CanvasEmbedChrome title={parsed.title} location={location} />
      )}
    </ExtensionApiContextProvider>,
    wrapper,
  );
};
