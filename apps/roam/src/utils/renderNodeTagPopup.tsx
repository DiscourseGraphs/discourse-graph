import React from "react";
import ReactDOM from "react-dom";
import { Button, Popover, Position } from "@blueprintjs/core";
import { renderCreateNodeDialog } from "~/components/CreateNodeDialog";
import { OnloadArgs } from "roamjs-components/types";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getDiscourseNodes from "./getDiscourseNodes";

export const renderNodeTagPopupButton = (
  parent: HTMLSpanElement,
  extensionAPI: OnloadArgs["extensionAPI"],
) => {
  if (parent.dataset.attributeButtonRendered === "true") return;

  parent.dataset.attributeButtonRendered = "true";
  const wrapper = document.createElement("span");
  wrapper.style.position = "relative";
  wrapper.style.display = "inline-block";
  parent.parentNode?.insertBefore(wrapper, parent);
  wrapper.appendChild(parent);

  const reactRoot = document.createElement("span");
  reactRoot.style.position = "absolute";
  reactRoot.style.top = "0";
  reactRoot.style.left = "0";
  reactRoot.style.width = "100%";
  reactRoot.style.height = "100%";
  reactRoot.style.pointerEvents = "auto";
  reactRoot.style.zIndex = "10";

  wrapper.appendChild(reactRoot);

  const textContent = parent.textContent?.trim() || "";
  const tagAttr = parent.getAttribute("data-tag") || textContent;
  const tag = tagAttr.replace(/^#/, "").toLowerCase();
  const discourseNodes = getDiscourseNodes();
  const discourseTagSet = new Set(
    discourseNodes
      .map((n) => n.tag?.replace(/^#/, "").toLowerCase())
      .filter(Boolean),
  );
  if (!discourseTagSet.has(tag)) return;

  const matchedNode = discourseNodes.find(
    (n) => n.tag?.replace(/^#/, "").toLowerCase() === tag,
  );

  if (!matchedNode) return;

  const blockInputElement = parent.closest(".rm-block__input");
  const blockUid = blockInputElement
    ? getUids(blockInputElement as HTMLDivElement).blockUid
    : undefined;

  const rawBlockText = blockUid ? getTextByBlockUid(blockUid) : "";
  const cleanedBlockText = rawBlockText.replace(textContent, "").trim();

  ReactDOM.render(
    <Popover
      content={
        <Button
          minimal
          outlined
          onClick={() => {
            renderCreateNodeDialog({
              onClose: () => {},
              defaultNodeTypeUid: matchedNode.type,
              extensionAPI,
              sourceBlockUid: blockUid,
              initialTitle: cleanedBlockText,
            });
          }}
          text={`Create #${matchedNode.tag?.replace(/^#/, "").toLowerCase()}`}
        />
      }
      target={
        <span
          style={{
            display: "block",
            width: "100%",
            height: "100%",
          }}
        />
      }
      interactionKind="hover"
      position={Position.TOP}
      modifiers={{
        offset: {
          offset: "0, 10",
        },
        arrow: {
          enabled: false,
        },
      }}
    />,
    reactRoot,
  );
};
